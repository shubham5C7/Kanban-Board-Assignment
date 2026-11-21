import { Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Board } from '../models/Board';
import { Column } from '../models/Column';
import { Task } from '../models/Task';
import { ActivityLog } from '../models/ActivityLog';
import { TenantEvent } from '../models/TenantEvent';
import { recordTenantEvent } from '../services/eventService';
import { generateKeyBetween } from '../utils/fractionalIndex';
import { AuthenticatedRequest } from '../types';

const CreateBoardSchema = z.object({
  name: z.string().trim().min(1, 'Board name cannot be empty'),
  description: z.string().optional(),
});

const UpdateBoardSchema = z.object({
  name: z.string().trim().min(1, 'Board name cannot be empty').optional(),
  description: z.string().optional(),
  expectedVersion: z.number().optional(),
});

export async function getBoards(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const boards = await Board.find({ tenantId: new mongoose.Types.ObjectId(tenantId), deletedAt: null })
    .sort({ createdAt: -1 })
    .populate('createdBy', 'name email avatarUrl');

  res.json({ boards });
}

export async function getBoard(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { boardId } = req.params;

  if (!mongoose.isValidObjectId(boardId)) {
    res.status(404).json({ code: 'board_not_found', message: 'Board not found' });
    return;
  }

  // Tenant-scoped query strictly prevents cross-tenant access
  const board = await Board.findOne({
    _id: new mongoose.Types.ObjectId(boardId),
    tenantId: new mongoose.Types.ObjectId(tenantId),
    deletedAt: null,
  }).populate('createdBy', 'name email avatarUrl');

  if (!board) {
    res.status(404).json({ code: 'board_not_found', message: 'Board not found' });
    return;
  }

  // Fetch columns ordered by fractional position
  const columns = await Column.find({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    boardId: board._id,
    deletedAt: null,
  }).sort({ position: 1 });

  // Fetch all active tasks (deletedAt is null)
  const tasks = await Task.find({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    boardId: board._id,
    deletedAt: null,
  })
    .sort({ position: 1 })
    .populate('assigneeId', 'name email avatarUrl');

  // Fetch latest event sequence to keep client cursor fresh
  const latestEvent = await TenantEvent.findOne({
    tenantId: new mongoose.Types.ObjectId(tenantId),
  }).sort({ seq: -1 });

  res.json({
    board,
    columns,
    tasks,
    latestSeq: latestEvent?.seq || 0,
  });
}

export async function createBoard(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.user!.id;
  const data = CreateBoardSchema.parse(req.body);

  const board = await Board.create({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    name: data.name,
    description: data.description || '',
    version: 1,
    createdBy: new mongoose.Types.ObjectId(userId),
  });

  // Create default starter columns with fractional indices
  const defaultCols = [
    { name: 'Backlog', color: '#64748c' },
    { name: 'In Progress', color: '#64748c' },
    { name: 'In Review', color: '#64748c' },
    { name: 'Completed', color: '#64748c' },
  ];

  let prevPos: string | null = null;
  const createdColumns = [];

  for (const col of defaultCols) {
    const pos = generateKeyBetween(prevPos, null);
    const newCol = await Column.create({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      boardId: board._id,
      name: col.name,
      color: col.color,
      position: pos,
      version: 1,
    });
    createdColumns.push(newCol);
    prevPos = pos;
  }

  // Record activity log
  await ActivityLog.create({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    boardId: board._id,
    actorId: new mongoose.Types.ObjectId(userId),
    actorName: req.user!.name,
    actorEmail: req.user!.email,
    entityType: 'BOARD',
    entityId: board._id.toString(),
    action: 'BOARD_CREATED',
    details: { name: board.name },
  });

  // Record tenant event and broadcast
  await recordTenantEvent(
    tenantId,
    'board.created',
    { id: userId, name: req.user!.name },
    { board, columns: createdColumns }
  );

  res.status(201).json({ board, columns: createdColumns });
}

export async function updateBoard(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { boardId } = req.params;
  const data = UpdateBoardSchema.parse(req.body);

  const board = await Board.findOne({
    _id: new mongoose.Types.ObjectId(boardId),
    tenantId: new mongoose.Types.ObjectId(tenantId),
    deletedAt: null,
  });

  if (!board) {
    res.status(404).json({ code: 'board_not_found', message: 'Board not found' });
    return;
  }

  // Concurrency check
  if (data.expectedVersion === undefined || board.version !== data.expectedVersion) {
    res.status(409).json({
      code: 'version_conflict',
      message: 'Board was modified by another user. Please reload.',
      currentRecord: board,
    });
    return;
  }

  if (data.name) board.name = data.name;
  if (data.description !== undefined) board.description = data.description;
  board.version += 1;
  await board.save();

  await recordTenantEvent(
    tenantId,
    'board.updated',
    { id: req.user!.id, name: req.user!.name },
    { board }
  );

  res.json({ board });
}

export async function deleteBoard(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { boardId } = req.params;
  if (!mongoose.isValidObjectId(boardId)) {
    res.status(404).json({ code: 'board_not_found', message: 'Board not found' });
    return;
  }
  const boardObjectId = new mongoose.Types.ObjectId(boardId);
  const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
  const board = await Board.findOne({
    _id: boardObjectId,
    tenantId: tenantObjectId,
    deletedAt: null,
  });

  if (!board) {
    res.status(404).json({ code: 'board_not_found', message: 'Board not found' });
    return;
  }

  const isAdmin = req.membership?.role === 'ORG_ADMIN' || req.membership?.role === 'TENANT_ADMIN';
  if (!isAdmin && board.createdBy.toString() !== req.user!.id) {
    res.status(403).json({
      code: 'forbidden',
      message: 'Only the board creator or an admin can delete this board.',
    });
    return;
  }

  const deletedAt = new Date();
  const deletedBy = new mongoose.Types.ObjectId(req.user!.id);
  board.deletedAt = deletedAt;
  board.deletedBy = deletedBy;
  await board.save();

  await Column.updateMany(
    { boardId: boardObjectId, tenantId: tenantObjectId, deletedAt: null },
    { $set: { deletedAt, deletedBy } }
  );
  await Task.updateMany(
    { boardId: boardObjectId, tenantId: tenantObjectId, deletedAt: null },
    { $set: { deletedAt, deletedBy } }
  );

  await ActivityLog.create({
    tenantId: tenantObjectId,
    boardId: boardObjectId,
    actorId: deletedBy,
    actorName: req.user!.name,
    actorEmail: req.user!.email,
    entityType: 'BOARD',
    entityId: boardObjectId.toString(),
    action: 'BOARD_DELETED',
    details: { name: board.name, message: 'Board deleted' },
  });

  await recordTenantEvent(
    tenantId,
    'board.deleted',
    { id: req.user!.id, name: req.user!.name },
    { boardId, board: { _id: boardId, name: board.name } }
  );

  res.json({ message: 'Board deleted successfully' });
}
