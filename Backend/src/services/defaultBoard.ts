import { ActivityLog } from '../models/ActivityLog';
import { Board } from '../models/Board';
import { Column } from '../models/Column';
import { Membership } from '../models/Membership';
import { Task } from '../models/Task';
import { TenantEvent } from '../models/TenantEvent';
import { ITenant, Tenant } from '../models/Tenant';
import { IUser } from '../models/User';
import { recordTenantEvent } from './eventService';
import { generateKeyBetween } from '../utils/fractionalIndex';

const DEFAULT_COLUMNS = [
  { name: 'Backlog', color: '#64748c' },
  { name: 'In Progress', color: '#64748c' },
  { name: 'In Review', color: '#64748c' },
  { name: 'Completed', color: '#64748c' },
];

export async function createDefaultBoard(tenant: ITenant, user: IUser): Promise<void> {
  const tenantId = tenant._id;
  const userId = user._id;

  let board = await Board.findOne({ tenantId, name: 'Getting Started', deletedAt: null });
  const boardWasCreated = !board;
  if (!board) {
    board = await Board.create({
      tenantId,
      name: 'Getting Started',
      description: 'Your first board. Drag cards between columns to get started.',
      version: 1,
      createdBy: userId,
    });
  }

  const columns = await Column.find({ tenantId, boardId: board._id, deletedAt: null }).sort({ position: 1 });
  for (let index = 0; index < Math.min(columns.length, DEFAULT_COLUMNS.length); index += 1) {
    const expectedColumn = DEFAULT_COLUMNS[index];
    const existingColumn = columns[index];
    if (existingColumn.name !== expectedColumn.name || existingColumn.color !== expectedColumn.color) {
      existingColumn.name = expectedColumn.name;
      existingColumn.color = expectedColumn.color;
      existingColumn.version += 1;
      await existingColumn.save();
    }
  }

  let previousPosition: string | null = columns[columns.length - 1]?.position || null;
  for (const columnData of DEFAULT_COLUMNS.slice(columns.length)) {
    const position = generateKeyBetween(previousPosition, null);
    const column = await Column.create({
      tenantId,
      boardId: board._id,
      ...columnData,
      position,
      version: 1,
    });
    columns.push(column);
    previousPosition = position;
  }

  const backlog = columns[0] || await Column.findOne({ tenantId, boardId: board._id, name: 'Backlog', deletedAt: null });
  if (!backlog) throw new Error('Default board is missing its Backlog column');

  let task = await Task.findOne({ tenantId, boardId: board._id, title: 'Welcome to CollabKanban', deletedAt: null });
  const taskWasCreated = !task;
  if (!task) {
    task = await Task.create({
      tenantId,
      boardId: board._id,
      columnId: backlog._id,
      title: 'Welcome to CollabKanban',
      description: 'Drag this card to another column, or click it to edit.',
      priority: 'MEDIUM',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      labels: ['Getting Started'],
      assigneeId: userId,
      position: generateKeyBetween(null, null),
      version: 1,
      deletedAt: null,
    });
  }

  const boardActivityExists = await ActivityLog.exists({
    tenantId,
    entityType: 'BOARD',
    entityId: board._id.toString(),
    action: 'BOARD_CREATED',
  });
  if (!boardActivityExists) {
    await ActivityLog.create({
      tenantId,
      boardId: board._id,
      actorId: userId,
      actorName: user.name,
      actorEmail: user.email,
      entityType: 'BOARD',
      entityId: board._id.toString(),
      action: 'BOARD_CREATED',
      details: { name: board.name },
    });
  }

  const boardEventExists = await TenantEvent.exists({
    tenantId,
    type: 'board.created',
    'data.board._id': board._id,
  });
  if (!boardEventExists || boardWasCreated) {
    await recordTenantEvent(
      tenantId.toString(),
      'board.created',
      { id: userId.toString(), name: user.name },
      { board, columns }
    );
  }

  const taskActivityExists = await ActivityLog.exists({
    tenantId,
    entityType: 'TASK',
    entityId: task._id.toString(),
    action: 'TASK_CREATED',
  });
  if (!taskActivityExists) {
    await ActivityLog.create({
      tenantId,
      boardId: board._id,
      actorId: userId,
      actorName: user.name,
      actorEmail: user.email,
      entityType: 'TASK',
      entityId: task._id.toString(),
      action: 'TASK_CREATED',
      details: { title: task.title, column: backlog.name },
      after: task.toObject(),
    });
  }

  const taskEventExists = await TenantEvent.exists({
    tenantId,
    type: 'task.created',
    'data.task._id': task._id,
  });
  if (!taskEventExists || taskWasCreated) {
    const populatedTask = await Task.findById(task._id).populate('assigneeId', 'name email avatarUrl');
    await recordTenantEvent(
      tenantId.toString(),
      'task.created',
      { id: userId.toString(), name: user.name },
      { task: populatedTask }
    );
  }
}

export async function ensureDefaultBoardsForUser(user: IUser): Promise<void> {
  const memberships = await Membership.find({ userId: user._id })
    .select('organizationId tenantId')
    .lean();
  const tenantIds = memberships.flatMap(membership => membership.tenantId ? [membership.tenantId] : []);
  const organizationIds = memberships.flatMap(membership => membership.tenantId ? [] : [membership.organizationId]);
  if (tenantIds.length === 0 && organizationIds.length === 0) return;

  const tenants = await Tenant.find({
    $or: [
      { _id: { $in: tenantIds } },
      { organizationId: { $in: organizationIds } },
    ],
  });

  for (const tenant of tenants) {
    const existingBoard = await Board.exists({ tenantId: tenant._id, deletedAt: null });
    const gettingStartedBoard = await Board.findOne({ tenantId: tenant._id, name: 'Getting Started', deletedAt: null });
    if (!existingBoard || gettingStartedBoard) {
      const starterColumns = gettingStartedBoard
        ? await Column.countDocuments({ tenantId: tenant._id, boardId: gettingStartedBoard._id, deletedAt: null })
        : 0;
      const starterTask = gettingStartedBoard
        ? await Task.exists({ tenantId: tenant._id, boardId: gettingStartedBoard._id, title: 'Welcome to CollabKanban', deletedAt: null })
        : null;
      const starterTaskWasCreated = gettingStartedBoard
        ? await ActivityLog.exists({
            tenantId: tenant._id,
            boardId: gettingStartedBoard._id,
            entityType: 'TASK',
            action: 'TASK_CREATED',
            'details.title': 'Welcome to CollabKanban',
          })
        : null;

      if (!existingBoard || starterColumns < DEFAULT_COLUMNS.length || (!starterTask && !starterTaskWasCreated)) {
        await createDefaultBoard(tenant, user);
      }
    }
  }
}
