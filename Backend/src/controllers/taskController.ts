import { Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Task } from '../models/Task';
import { Column } from '../models/Column';
import { Board } from '../models/Board';
import { ActivityLog } from '../models/ActivityLog';
import { recordTenantEvent } from '../services/eventService';
import { generateKeyBetween } from '../utils/fractionalIndex';
import { AuthenticatedRequest } from '../types';

const CreateTaskSchema = z.object({
  title: z.string().trim().min(1, 'Task title cannot be empty'),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  labels: z.array(z.string()).default([]),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  afterPosition: z.string().optional().nullable(),
});

const UpdateTaskSchema = z.object({
  title: z.string().trim().min(1, 'Task title cannot be empty').optional(),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  labels: z.array(z.string()).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  expectedVersion: z.number().optional(),
});

const MoveTaskSchema = z.object({
  targetColumnId: z.string(),
  beforePosition: z.string().optional().nullable(),
  afterPosition: z.string().optional().nullable(),
  expectedVersion: z.number().optional(),
});

const UndoTaskSchema = z.object({
  expectedVersion: z.number(),
  previousState: z.object({
    columnId: z.string().optional(),
    position: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  }),
});

export async function createTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { columnId } = req.params;
  const data = CreateTaskSchema.parse(req.body);

  if (!mongoose.isValidObjectId(columnId)) {
    res.status(404).json({ code: 'column_not_found', message: 'Target column not found in this tenant' });
    return;
  }

  const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
  const columnObjectId = new mongoose.Types.ObjectId(columnId);

  // Validate column belongs to tenant
  const column = await Column.findOne({ _id: columnObjectId, tenantId: tenantObjectId });
  if (!column) {
    res.status(404).json({ code: 'column_not_found', message: 'Target column not found in this tenant' });
    return;
  }

  // Calculate fractional position
  const lastTask = await Task.findOne({
    tenantId: tenantObjectId,
    columnId: columnObjectId,
    deletedAt: null,
  })
    .sort({ position: -1 })
    .lean();

  const position = generateKeyBetween(lastTask?.position || null, null);

  const validAssigneeId =
    data.assigneeId && mongoose.isValidObjectId(data.assigneeId)
      ? new mongoose.Types.ObjectId(data.assigneeId)
      : null;

  const task = await Task.create({
    tenantId: tenantObjectId,
    boardId: column.boardId,
    columnId: columnObjectId,
    title: data.title,
    description: data.description || '',
    priority: data.priority,
    labels: data.labels,
    dueDate: data.dueDate ? new Date(data.dueDate) : null,
    assigneeId: validAssigneeId,
    position,
    version: 1,
    deletedAt: null,
  });

  const populatedTask = await Task.findById(task._id).populate('assigneeId', 'name email avatarUrl');

  // Activity log
  await ActivityLog.create({
    tenantId: tenantObjectId,
    boardId: column.boardId,
    actorId: new mongoose.Types.ObjectId(req.user!.id),
    actorName: req.user!.name,
    actorEmail: req.user!.email,
    entityType: 'TASK',
    entityId: task._id.toString(),
    action: 'TASK_CREATED',
    details: { title: task.title, column: column.name },
    after: task.toObject(),
  });

  await recordTenantEvent(
    tenantId,
    'task.created',
    { id: req.user!.id, name: req.user!.name },
    { task: populatedTask }
  );

  res.status(201).json({ task: populatedTask });
}

export async function getTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { taskId } = req.params;

  if (!mongoose.isValidObjectId(taskId)) {
    res.status(404).json({ code: 'task_not_found', message: 'Task not found' });
    return;
  }

  // Cross-tenant ID guessing returns 404
  const task = await Task.findOne({
    _id: new mongoose.Types.ObjectId(taskId),
    tenantId: new mongoose.Types.ObjectId(tenantId),
    deletedAt: null,
  }).populate('assigneeId', 'name email avatarUrl');

  if (!task) {
    res.status(404).json({ code: 'task_not_found', message: 'Task not found' });
    return;
  }

  res.json({ task });
}

export async function updateTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { taskId } = req.params;
  const data = UpdateTaskSchema.parse(req.body);

  const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
  const taskObjectId = new mongoose.Types.ObjectId(taskId);

  const task = await Task.findOne({
    _id: taskObjectId,
    tenantId: tenantObjectId,
    deletedAt: null,
  });

  if (!task) {
    res.status(404).json({ code: 'task_not_found', message: 'Task not found' });
    return;
  }

  // Optimistic Concurrency Control (OCC) Check
  if (data.expectedVersion !== undefined && task.version !== data.expectedVersion) {
    const currentPopulated = await Task.findById(task._id).populate('assigneeId', 'name email avatarUrl');
    res.status(409).json({
      code: 'version_conflict',
      message: 'Task has been modified by another teammate since you loaded it.',
      currentRecord: currentPopulated,
    });
    return;
  }

  const beforeState = task.toObject();

  if (data.title !== undefined) task.title = data.title;
  if (data.description !== undefined) task.description = data.description;
  if (data.priority !== undefined) task.priority = data.priority;
  if (data.labels !== undefined) task.labels = data.labels;
  if (data.dueDate !== undefined) task.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  if (data.assigneeId !== undefined) {
    task.assigneeId =
      data.assigneeId && mongoose.isValidObjectId(data.assigneeId)
        ? new mongoose.Types.ObjectId(data.assigneeId)
        : null;
  }

  task.version += 1;
  await task.save();

  const updatedTask = await Task.findById(task._id).populate('assigneeId', 'name email avatarUrl');

  await ActivityLog.create({
    tenantId: tenantObjectId,
    boardId: task.boardId,
    actorId: new mongoose.Types.ObjectId(req.user!.id),
    actorName: req.user!.name,
    actorEmail: req.user!.email,
    entityType: 'TASK',
    entityId: task._id.toString(),
    action: 'TASK_UPDATED',
    details: { title: task.title },
    before: beforeState,
    after: task.toObject(),
  });

  await recordTenantEvent(
    tenantId,
    'task.updated',
    { id: req.user!.id, name: req.user!.name },
    { task: updatedTask, previousVersion: task.version - 1 }
  );

  res.json({ task: updatedTask });
}

export async function moveTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { taskId } = req.params;
  const data = MoveTaskSchema.parse(req.body);

  if (!mongoose.isValidObjectId(taskId)) {
    res.status(404).json({ code: 'task_not_found', message: 'Task not found' });
    return;
  }

  if (!mongoose.isValidObjectId(data.targetColumnId)) {
    res.status(409).json({
      code: 'column_deleted',
      message: 'The destination column was removed or does not exist.',
    });
    return;
  }

  const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
  const taskObjectId = new mongoose.Types.ObjectId(taskId);
  const targetColumnObjectId = new mongoose.Types.ObjectId(data.targetColumnId);

  // Check if target column exists in tenant (handles Edge Case 124: drag onto deleted column)
  const targetColumn = await Column.findOne({
    _id: targetColumnObjectId,
    tenantId: tenantObjectId,
  });

  if (!targetColumn) {
    res.status(409).json({
      code: 'column_deleted',
      message: 'The destination column was removed or does not exist.',
    });
    return;
  }

  const task = await Task.findOne({
    _id: taskObjectId,
    tenantId: tenantObjectId,
    deletedAt: null,
  });

  if (!task) {
    res.status(404).json({ code: 'task_not_found', message: 'Task not found' });
    return;
  }

  // OCC check
  if (data.expectedVersion !== undefined && task.version !== data.expectedVersion) {
    const currentPopulated = await Task.findById(task._id).populate('assigneeId', 'name email avatarUrl');
    res.status(409).json({
      code: 'version_conflict',
      message: 'Card position was altered by another user.',
      currentRecord: currentPopulated,
    });
    return;
  }

  const prevColumnId = task.columnId.toString();
  const prevPosition = task.position;
  const prevVersion = task.version;

  const newPosition = generateKeyBetween(data.beforePosition, data.afterPosition);
  task.columnId = targetColumnObjectId;
  task.position = newPosition;
  task.version += 1;
  await task.save();

  const updatedTask = await Task.findById(task._id).populate('assigneeId', 'name email avatarUrl');

  await ActivityLog.create({
    tenantId: tenantObjectId,
    boardId: task.boardId,
    actorId: new mongoose.Types.ObjectId(req.user!.id),
    actorName: req.user!.name,
    actorEmail: req.user!.email,
    entityType: 'TASK',
    entityId: task._id.toString(),
    action: 'TASK_MOVED',
    details: {
      fromColumnId: prevColumnId,
      toColumnId: data.targetColumnId,
      toColumnName: targetColumn.name,
    },
    before: { columnId: prevColumnId, position: prevPosition, version: prevVersion },
    after: { columnId: data.targetColumnId, position: newPosition, version: task.version },
  });

  await recordTenantEvent(
    tenantId,
    'task.moved',
    { id: req.user!.id, name: req.user!.name },
    {
      task: updatedTask,
      previousColumnId: prevColumnId,
      previousPosition: prevPosition,
      previousVersion: prevVersion,
    }
  );

  res.json({
    task: updatedTask,
    undoPayload: {
      taskId: task._id.toString(),
      columnId: prevColumnId,
      position: prevPosition,
      expectedVersion: task.version,
    },
  });
}

export async function deleteTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { taskId } = req.params;
  const user = req.user!;
  const role = req.membership?.role;

  const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
  const taskObjectId = new mongoose.Types.ObjectId(taskId);

  const task = await Task.findOne({
    _id: taskObjectId,
    tenantId: tenantObjectId,
    deletedAt: null,
  });

  if (!task) {
    res.status(404).json({ code: 'task_not_found', message: 'Task not found' });
    return;
  }

  // PRD Table: Members can only delete own tasks (assigned to them)
  if (role === 'MEMBER' && task.assigneeId?.toString() !== user.id) {
    res.status(403).json({
      code: 'forbidden',
      message: 'Members can only delete their own assigned tasks',
    });
    return;
  }

  // Soft delete
  task.deletedAt = new Date();
  task.version += 1;
  await task.save();

  await ActivityLog.create({
    tenantId: tenantObjectId,
    boardId: task.boardId,
    actorId: new mongoose.Types.ObjectId(user.id),
    actorName: user.name,
    actorEmail: user.email,
    entityType: 'TASK',
    entityId: task._id.toString(),
    action: 'TASK_DELETED',
    details: { title: task.title },
  });

  await recordTenantEvent(
    tenantId,
    'task.deleted',
    { id: user.id, name: user.name },
    { taskId, boardId: task.boardId, columnId: task.columnId }
  );

  res.json({ message: 'Task deleted successfully' });
}

export async function undoTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { taskId } = req.params;
  const data = UndoTaskSchema.parse(req.body);

  const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
  const taskObjectId = new mongoose.Types.ObjectId(taskId);

  const task = await Task.findOne({
    _id: taskObjectId,
    tenantId: tenantObjectId,
  });

  if (!task) {
    res.status(404).json({ code: 'task_not_found', message: 'Task not found' });
    return;
  }

  // If another teammate has modified the card in the meantime, reject undo!
  // PRD Edge case: "Undo of a change someone else has since edited is rejected with a notice"
  if (task.version !== data.expectedVersion) {
    res.status(409).json({
      code: 'conflict_undo_stale',
      message: 'Cannot undo: card was modified by someone else since your action.',
    });
    return;
  }

  if (data.previousState.columnId) {
    task.columnId = new mongoose.Types.ObjectId(data.previousState.columnId);
  }
  if (data.previousState.position) {
    task.position = data.previousState.position;
  }
  if (data.previousState.title) {
    task.title = data.previousState.title;
  }
  if (data.previousState.description) {
    task.description = data.previousState.description;
  }
  if (data.previousState.priority) {
    task.priority = data.previousState.priority;
  }

  task.version += 1;
  await task.save();

  const updatedTask = await Task.findById(task._id).populate('assigneeId', 'name email avatarUrl');

  await recordTenantEvent(
    tenantId,
    'task.moved',
    { id: req.user!.id, name: req.user!.name },
    { task: updatedTask, isUndo: true }
  );

  res.json({ task: updatedTask, message: 'Action undone successfully' });
}
