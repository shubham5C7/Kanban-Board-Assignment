"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBoards = getBoards;
exports.getBoard = getBoard;
exports.createBoard = createBoard;
exports.updateBoard = updateBoard;
exports.deleteBoard = deleteBoard;
const zod_1 = require("zod");
const mongoose_1 = __importDefault(require("mongoose"));
const Board_1 = require("../models/Board");
const Column_1 = require("../models/Column");
const Task_1 = require("../models/Task");
const ActivityLog_1 = require("../models/ActivityLog");
const TenantEvent_1 = require("../models/TenantEvent");
const eventService_1 = require("../services/eventService");
const fractionalIndex_1 = require("../utils/fractionalIndex");
const CreateBoardSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, 'Board name cannot be empty'),
    description: zod_1.z.string().optional(),
});
const UpdateBoardSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, 'Board name cannot be empty').optional(),
    description: zod_1.z.string().optional(),
    expectedVersion: zod_1.z.number().optional(),
});
async function getBoards(req, res) {
    const tenantId = req.tenantId;
    const boards = await Board_1.Board.find({ tenantId: new mongoose_1.default.Types.ObjectId(tenantId) })
        .sort({ createdAt: -1 })
        .populate('createdBy', 'name email avatarUrl');
    res.json({ boards });
}
async function getBoard(req, res) {
    const tenantId = req.tenantId;
    const { boardId } = req.params;
    if (!mongoose_1.default.isValidObjectId(boardId)) {
        res.status(404).json({ code: 'board_not_found', message: 'Board not found' });
        return;
    }
    // Tenant-scoped query strictly prevents cross-tenant access
    const board = await Board_1.Board.findOne({
        _id: new mongoose_1.default.Types.ObjectId(boardId),
        tenantId: new mongoose_1.default.Types.ObjectId(tenantId),
    }).populate('createdBy', 'name email avatarUrl');
    if (!board) {
        res.status(404).json({ code: 'board_not_found', message: 'Board not found' });
        return;
    }
    // Fetch columns ordered by fractional position
    const columns = await Column_1.Column.find({
        tenantId: new mongoose_1.default.Types.ObjectId(tenantId),
        boardId: board._id,
    }).sort({ position: 1 });
    // Fetch all active tasks (deletedAt is null)
    const tasks = await Task_1.Task.find({
        tenantId: new mongoose_1.default.Types.ObjectId(tenantId),
        boardId: board._id,
        deletedAt: null,
    })
        .sort({ position: 1 })
        .populate('assigneeId', 'name email avatarUrl');
    // Fetch latest event sequence to keep client cursor fresh
    const latestEvent = await TenantEvent_1.TenantEvent.findOne({
        tenantId: new mongoose_1.default.Types.ObjectId(tenantId),
    }).sort({ seq: -1 });
    res.json({
        board,
        columns,
        tasks,
        latestSeq: latestEvent?.seq || 0,
    });
}
async function createBoard(req, res) {
    const tenantId = req.tenantId;
    const userId = req.user.id;
    const data = CreateBoardSchema.parse(req.body);
    const board = await Board_1.Board.create({
        tenantId: new mongoose_1.default.Types.ObjectId(tenantId),
        name: data.name,
        description: data.description || '',
        version: 1,
        createdBy: new mongoose_1.default.Types.ObjectId(userId),
    });
    // Create default starter columns with fractional indices
    const defaultCols = [
        { name: 'To Do', color: '#64748b' },
        { name: 'In Progress', color: '#3b82f6' },
        { name: 'Review', color: '#f59e0b' },
        { name: 'Done', color: '#10b981' },
    ];
    let prevPos = null;
    const createdColumns = [];
    for (const col of defaultCols) {
        const pos = (0, fractionalIndex_1.generateKeyBetween)(prevPos, null);
        const newCol = await Column_1.Column.create({
            tenantId: new mongoose_1.default.Types.ObjectId(tenantId),
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
    await ActivityLog_1.ActivityLog.create({
        tenantId: new mongoose_1.default.Types.ObjectId(tenantId),
        boardId: board._id,
        actorId: new mongoose_1.default.Types.ObjectId(userId),
        actorName: req.user.name,
        actorEmail: req.user.email,
        entityType: 'BOARD',
        entityId: board._id.toString(),
        action: 'BOARD_CREATED',
        details: { name: board.name },
    });
    // Record tenant event and broadcast
    await (0, eventService_1.recordTenantEvent)(tenantId, 'board.created', { id: userId, name: req.user.name }, { board, columns: createdColumns });
    res.status(201).json({ board, columns: createdColumns });
}
async function updateBoard(req, res) {
    const tenantId = req.tenantId;
    const { boardId } = req.params;
    const data = UpdateBoardSchema.parse(req.body);
    const board = await Board_1.Board.findOne({
        _id: new mongoose_1.default.Types.ObjectId(boardId),
        tenantId: new mongoose_1.default.Types.ObjectId(tenantId),
    });
    if (!board) {
        res.status(404).json({ code: 'board_not_found', message: 'Board not found' });
        return;
    }
    // Concurrency check
    if (data.expectedVersion !== undefined && board.version !== data.expectedVersion) {
        res.status(409).json({
            code: 'version_conflict',
            message: 'Board was modified by another user. Please reload.',
            currentRecord: board,
        });
        return;
    }
    if (data.name)
        board.name = data.name;
    if (data.description !== undefined)
        board.description = data.description;
    board.version += 1;
    await board.save();
    await (0, eventService_1.recordTenantEvent)(tenantId, 'board.updated', { id: req.user.id, name: req.user.name }, { board });
    res.json({ board });
}
async function deleteBoard(req, res) {
    const tenantId = req.tenantId;
    const { boardId } = req.params;
    const boardObjectId = new mongoose_1.default.Types.ObjectId(boardId);
    const tenantObjectId = new mongoose_1.default.Types.ObjectId(tenantId);
    const board = await Board_1.Board.findOneAndDelete({
        _id: boardObjectId,
        tenantId: tenantObjectId,
    });
    if (!board) {
        res.status(404).json({ code: 'board_not_found', message: 'Board not found' });
        return;
    }
    await Column_1.Column.deleteMany({ boardId: boardObjectId, tenantId: tenantObjectId });
    await Task_1.Task.deleteMany({ boardId: boardObjectId, tenantId: tenantObjectId });
    await (0, eventService_1.recordTenantEvent)(tenantId, 'board.deleted', { id: req.user.id, name: req.user.name }, { boardId });
    res.json({ message: 'Board deleted successfully' });
}
