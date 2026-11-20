"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTask = createTask;
exports.getTask = getTask;
exports.updateTask = updateTask;
exports.moveTask = moveTask;
exports.deleteTask = deleteTask;
exports.undoTask = undoTask;
const zod_1 = require("zod");
const mongoose_1 = __importDefault(require("mongoose"));
const Task_1 = require("../models/Task");
const Column_1 = require("../models/Column");
const ActivityLog_1 = require("../models/ActivityLog");
const eventService_1 = require("../services/eventService");
const fractionalIndex_1 = require("../utils/fractionalIndex");
const CreateTaskSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1, 'Task title cannot be empty'),
    description: zod_1.z.string().optional(),
    priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
    labels: zod_1.z.array(zod_1.z.string()).default([]),
    dueDate: zod_1.z.string().datetime().optional().nullable(),
    assigneeId: zod_1.z.string().optional().nullable(),
    afterPosition: zod_1.z.string().optional().nullable(),
});
const UpdateTaskSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1, 'Task title cannot be empty').optional(),
    description: zod_1.z.string().optional(),
    priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    labels: zod_1.z.array(zod_1.z.string()).optional(),
    dueDate: zod_1.z.string().datetime().optional().nullable(),
    assigneeId: zod_1.z.string().optional().nullable(),
    expectedVersion: zod_1.z.number().optional(),
});
const MoveTaskSchema = zod_1.z.object({
    targetColumnId: zod_1.z.string(),
    beforePosition: zod_1.z.string().optional().nullable(),
    afterPosition: zod_1.z.string().optional().nullable(),
    expectedVersion: zod_1.z.number().optional(),
});
const UndoTaskSchema = zod_1.z.object({
    expectedVersion: zod_1.z.number(),
    previousState: zod_1.z.object({
        columnId: zod_1.z.string().optional(),
        position: zod_1.z.string().optional(),
        title: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    }),
});
async function createTask(req, res) {
    const tenantId = req.tenantId;
    const { columnId } = req.params;
    const data = CreateTaskSchema.parse(req.body);
    if (!mongoose_1.default.isValidObjectId(columnId)) {
        res.status(404).json({ code: 'column_not_found', message: 'Target column not found in this tenant' });
        return;
    }
    const tenantObjectId = new mongoose_1.default.Types.ObjectId(tenantId);
    const columnObjectId = new mongoose_1.default.Types.ObjectId(columnId);
    // Validate column belongs to tenant
    const column = await Column_1.Column.findOne({ _id: columnObjectId, tenantId: tenantObjectId });
    if (!column) {
        res.status(404).json({ code: 'column_not_found', message: 'Target column not found in this tenant' });
        return;
    }
    // Calculate fractional position
    const lastTask = await Task_1.Task.findOne({
        tenantId: tenantObjectId,
        columnId: columnObjectId,
        deletedAt: null,
    })
        .sort({ position: -1 })
        .lean();
    const position = (0, fractionalIndex_1.generateKeyBetween)(lastTask?.position || null, null);
    const validAssigneeId = data.assigneeId && mongoose_1.default.isValidObjectId(data.assigneeId)
        ? new mongoose_1.default.Types.ObjectId(data.assigneeId)
        : null;
    const task = await Task_1.Task.create({
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
    const populatedTask = await Task_1.Task.findById(task._id).populate('assigneeId', 'name email avatarUrl');
    // Activity log
    await ActivityLog_1.ActivityLog.create({
        tenantId: tenantObjectId,
        boardId: column.boardId,
        actorId: new mongoose_1.default.Types.ObjectId(req.user.id),
        actorName: req.user.name,
        actorEmail: req.user.email,
        entityType: 'TASK',
        entityId: task._id.toString(),
        action: 'TASK_CREATED',
        details: { title: task.title, column: column.name },
        after: task.toObject(),
    });
    await (0, eventService_1.recordTenantEvent)(tenantId, 'task.created', { id: req.user.id, name: req.user.name }, { task: populatedTask });
    res.status(201).json({ task: populatedTask });
}
async function getTask(req, res) {
    const tenantId = req.tenantId;
    const { taskId } = req.params;
    if (!mongoose_1.default.isValidObjectId(taskId)) {
        res.status(404).json({ code: 'task_not_found', message: 'Task not found' });
        return;
    }
    // Cross-tenant ID guessing returns 404
    const task = await Task_1.Task.findOne({
        _id: new mongoose_1.default.Types.ObjectId(taskId),
        tenantId: new mongoose_1.default.Types.ObjectId(tenantId),
        deletedAt: null,
    }).populate('assigneeId', 'name email avatarUrl');
    if (!task) {
        res.status(404).json({ code: 'task_not_found', message: 'Task not found' });
        return;
    }
    res.json({ task });
}
async function updateTask(req, res) {
    const tenantId = req.tenantId;
    const { taskId } = req.params;
    const data = UpdateTaskSchema.parse(req.body);
    const tenantObjectId = new mongoose_1.default.Types.ObjectId(tenantId);
    const taskObjectId = new mongoose_1.default.Types.ObjectId(taskId);
    const task = await Task_1.Task.findOne({
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
        const currentPopulated = await Task_1.Task.findById(task._id).populate('assigneeId', 'name email avatarUrl');
        res.status(409).json({
            code: 'version_conflict',
            message: 'Task has been modified by another teammate since you loaded it.',
            currentRecord: currentPopulated,
        });
        return;
    }
    const beforeState = task.toObject();
    if (data.title !== undefined)
        task.title = data.title;
    if (data.description !== undefined)
        task.description = data.description;
    if (data.priority !== undefined)
        task.priority = data.priority;
    if (data.labels !== undefined)
        task.labels = data.labels;
    if (data.dueDate !== undefined)
        task.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.assigneeId !== undefined) {
        task.assigneeId =
            data.assigneeId && mongoose_1.default.isValidObjectId(data.assigneeId)
                ? new mongoose_1.default.Types.ObjectId(data.assigneeId)
                : null;
    }
    task.version += 1;
    await task.save();
    const updatedTask = await Task_1.Task.findById(task._id).populate('assigneeId', 'name email avatarUrl');
    await ActivityLog_1.ActivityLog.create({
        tenantId: tenantObjectId,
        boardId: task.boardId,
        actorId: new mongoose_1.default.Types.ObjectId(req.user.id),
        actorName: req.user.name,
        actorEmail: req.user.email,
        entityType: 'TASK',
        entityId: task._id.toString(),
        action: 'TASK_UPDATED',
        details: { title: task.title },
        before: beforeState,
        after: task.toObject(),
    });
    await (0, eventService_1.recordTenantEvent)(tenantId, 'task.updated', { id: req.user.id, name: req.user.name }, { task: updatedTask, previousVersion: task.version - 1 });
    res.json({ task: updatedTask });
}
async function moveTask(req, res) {
    const tenantId = req.tenantId;
    const { taskId } = req.params;
    const data = MoveTaskSchema.parse(req.body);
    if (!mongoose_1.default.isValidObjectId(taskId)) {
        res.status(404).json({ code: 'task_not_found', message: 'Task not found' });
        return;
    }
    if (!mongoose_1.default.isValidObjectId(data.targetColumnId)) {
        res.status(409).json({
            code: 'column_deleted',
            message: 'The destination column was removed or does not exist.',
        });
        return;
    }
    const tenantObjectId = new mongoose_1.default.Types.ObjectId(tenantId);
    const taskObjectId = new mongoose_1.default.Types.ObjectId(taskId);
    const targetColumnObjectId = new mongoose_1.default.Types.ObjectId(data.targetColumnId);
    // Check if target column exists in tenant (handles Edge Case 124: drag onto deleted column)
    const targetColumn = await Column_1.Column.findOne({
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
    const task = await Task_1.Task.findOne({
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
        const currentPopulated = await Task_1.Task.findById(task._id).populate('assigneeId', 'name email avatarUrl');
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
    const newPosition = (0, fractionalIndex_1.generateKeyBetween)(data.beforePosition, data.afterPosition);
    task.columnId = targetColumnObjectId;
    task.position = newPosition;
    task.version += 1;
    await task.save();
    const updatedTask = await Task_1.Task.findById(task._id).populate('assigneeId', 'name email avatarUrl');
    await ActivityLog_1.ActivityLog.create({
        tenantId: tenantObjectId,
        boardId: task.boardId,
        actorId: new mongoose_1.default.Types.ObjectId(req.user.id),
        actorName: req.user.name,
        actorEmail: req.user.email,
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
    await (0, eventService_1.recordTenantEvent)(tenantId, 'task.moved', { id: req.user.id, name: req.user.name }, {
        task: updatedTask,
        previousColumnId: prevColumnId,
        previousPosition: prevPosition,
        previousVersion: prevVersion,
    });
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
async function deleteTask(req, res) {
    const tenantId = req.tenantId;
    const { taskId } = req.params;
    const user = req.user;
    const role = req.membership?.role;
    const tenantObjectId = new mongoose_1.default.Types.ObjectId(tenantId);
    const taskObjectId = new mongoose_1.default.Types.ObjectId(taskId);
    const task = await Task_1.Task.findOne({
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
    await ActivityLog_1.ActivityLog.create({
        tenantId: tenantObjectId,
        boardId: task.boardId,
        actorId: new mongoose_1.default.Types.ObjectId(user.id),
        actorName: user.name,
        actorEmail: user.email,
        entityType: 'TASK',
        entityId: task._id.toString(),
        action: 'TASK_DELETED',
        details: { title: task.title },
    });
    await (0, eventService_1.recordTenantEvent)(tenantId, 'task.deleted', { id: user.id, name: user.name }, { taskId, boardId: task.boardId, columnId: task.columnId });
    res.json({ message: 'Task deleted successfully' });
}
async function undoTask(req, res) {
    const tenantId = req.tenantId;
    const { taskId } = req.params;
    const data = UndoTaskSchema.parse(req.body);
    const tenantObjectId = new mongoose_1.default.Types.ObjectId(tenantId);
    const taskObjectId = new mongoose_1.default.Types.ObjectId(taskId);
    const task = await Task_1.Task.findOne({
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
        task.columnId = new mongoose_1.default.Types.ObjectId(data.previousState.columnId);
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
    const updatedTask = await Task_1.Task.findById(task._id).populate('assigneeId', 'name email avatarUrl');
    await (0, eventService_1.recordTenantEvent)(tenantId, 'task.moved', { id: req.user.id, name: req.user.name }, { task: updatedTask, isUndo: true });
    res.json({ task: updatedTask, message: 'Action undone successfully' });
}
