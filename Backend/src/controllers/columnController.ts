import { Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Column } from '../models/Column';
import { Task } from '../models/Task';
import { ActivityLog } from '../models/ActivityLog';
import { recordTenantEvent } from '../services/eventService';
import { generateKeyBetween } from '../utils/fractionalIndex';
import { AuthenticatedRequest } from '../types';

const CreateColumnSchema = z.object({
  name: z.string().trim().min(1, 'Column name cannot be empty'),
  color: z.string().optional(),
  afterPosition: z.string().optional().nullable(),
});

const UpdateColumnSchema = z.object({
  name: z.string().trim().min(1, 'Column name cannot be empty').optional(),
  color: z.string().optional(),
  expectedVersion: z.number().optional(),
});

const MoveColumnSchema = z.object({
  beforePosition: z.string().optional().nullable(),
  afterPosition: z.string().optional().nullable(),
  expectedVersion: z.number().optional(),
});

export async function createColumn(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { boardId } = req.params;
  const data = CreateColumnSchema.parse(req.body);

  const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
  const boardObjectId = new mongoose.Types.ObjectId(boardId);

  // Find last column to calculate position
  const lastCol = await Column.findOne({ tenantId: tenantObjectId, boardId: boardObjectId })
    .sort({ position: -1 })
    .lean();

  const newPosition = generateKeyBetween(lastCol?.position || null, null);

  const column = await Column.create({
    tenantId: tenantObjectId,
    boardId: boardObjectId,
    name: data.name,
    color: data.color || '#64748b',
    position: newPosition,
    version: 1,
  });

  await ActivityLog.create({
    tenantId: tenantObjectId,
    boardId: boardObjectId,
    actorId: new mongoose.Types.ObjectId(req.user!.id),
    actorName: req.user!.name,
    actorEmail: req.user!.email,
    entityType: 'COLUMN',
    entityId: column._id.toString(),
    action: 'COLUMN_CREATED',
    details: { name: column.name },
  });

  await recordTenantEvent(
    tenantId,
    'column.created',
    { id: req.user!.id, name: req.user!.name },
    { column }
  );

  res.status(201).json({ column });
}

export async function updateColumn(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { columnId } = req.params;
  const data = UpdateColumnSchema.parse(req.body);

  const column = await Column.findOne({
    _id: new mongoose.Types.ObjectId(columnId),
    tenantId: new mongoose.Types.ObjectId(tenantId),
  });

  if (!column) {
    res.status(404).json({ code: 'column_not_found', message: 'Column not found' });
    return;
  }

  // OCC check
  if (data.expectedVersion !== undefined && column.version !== data.expectedVersion) {
    res.status(409).json({
      code: 'version_conflict',
      message: 'Column was modified by another user.',
      currentRecord: column,
    });
    return;
  }

  if (data.name) column.name = data.name;
  if (data.color) column.color = data.color;
  column.version += 1;
  await column.save();

  await recordTenantEvent(
    tenantId,
    'column.updated',
    { id: req.user!.id, name: req.user!.name },
    { column }
  );

  res.json({ column });
}

export async function moveColumn(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { columnId } = req.params;
  const data = MoveColumnSchema.parse(req.body);

  const column = await Column.findOne({
    _id: new mongoose.Types.ObjectId(columnId),
    tenantId: new mongoose.Types.ObjectId(tenantId),
  });

  if (!column) {
    res.status(404).json({ code: 'column_not_found', message: 'Column not found' });
    return;
  }

  if (data.expectedVersion !== undefined && column.version !== data.expectedVersion) {
    res.status(409).json({
      code: 'version_conflict',
      message: 'Column position conflict',
      currentRecord: column,
    });
    return;
  }

  const newPosition = generateKeyBetween(data.beforePosition, data.afterPosition);
  column.position = newPosition;
  column.version += 1;
  await column.save();

  await recordTenantEvent(
    tenantId,
    'column.moved',
    { id: req.user!.id, name: req.user!.name },
    { column }
  );

  res.json({ column });
}

export async function deleteColumn(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { columnId } = req.params;
  const columnObjectId = new mongoose.Types.ObjectId(columnId);
  const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

  const column = await Column.findOneAndDelete({
    _id: columnObjectId,
    tenantId: tenantObjectId,
  });

  if (!column) {
    res.status(404).json({ code: 'column_not_found', message: 'Column not found' });
    return;
  }

  // Soft-delete or mark tasks in this column as deleted
  await Task.updateMany(
    { columnId: columnObjectId, tenantId: tenantObjectId },
    { $set: { deletedAt: new Date() } }
  );

  await ActivityLog.create({
    tenantId: tenantObjectId,
    boardId: column.boardId,
    actorId: new mongoose.Types.ObjectId(req.user!.id),
    actorName: req.user!.name,
    actorEmail: req.user!.email,
    entityType: 'COLUMN',
    entityId: column._id.toString(),
    action: 'COLUMN_DELETED',
    details: { name: column.name },
  });

  await recordTenantEvent(
    tenantId,
    'column.deleted',
    { id: req.user!.id, name: req.user!.name },
    { columnId, boardId: column.boardId }
  );

  res.json({ message: 'Column deleted successfully' });
}
