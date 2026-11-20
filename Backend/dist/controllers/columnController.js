"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createColumn = createColumn;
exports.updateColumn = updateColumn;
exports.moveColumn = moveColumn;
exports.deleteColumn = deleteColumn;
const zod_1 = require("zod");
const mongoose_1 = __importDefault(require("mongoose"));
const Column_1 = require("../models/Column");
const Task_1 = require("../models/Task");
const ActivityLog_1 = require("../models/ActivityLog");
const eventService_1 = require("../services/eventService");
const fractionalIndex_1 = require("../utils/fractionalIndex");
const CreateColumnSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, 'Column name cannot be empty'),
    color: zod_1.z.string().optional(),
    afterPosition: zod_1.z.string().optional().nullable(),
});
const UpdateColumnSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, 'Column name cannot be empty').optional(),
    color: zod_1.z.string().optional(),
    expectedVersion: zod_1.z.number().optional(),
});
const MoveColumnSchema = zod_1.z.object({
    beforePosition: zod_1.z.string().optional().nullable(),
    afterPosition: zod_1.z.string().optional().nullable(),
    expectedVersion: zod_1.z.number().optional(),
});
async function createColumn(req, res) {
    const tenantId = req.tenantId;
    const { boardId } = req.params;
    const data = CreateColumnSchema.parse(req.body);
    const tenantObjectId = new mongoose_1.default.Types.ObjectId(tenantId);
    const boardObjectId = new mongoose_1.default.Types.ObjectId(boardId);
    // Find last column to calculate position
    const lastCol = await Column_1.Column.findOne({ tenantId: tenantObjectId, boardId: boardObjectId })
        .sort({ position: -1 })
        .lean();
    const newPosition = (0, fractionalIndex_1.generateKeyBetween)(lastCol?.position || null, null);
    const column = await Column_1.Column.create({
        tenantId: tenantObjectId,
        boardId: boardObjectId,
        name: data.name,
        color: data.color || '#64748b',
        position: newPosition,
        version: 1,
    });
    await ActivityLog_1.ActivityLog.create({
        tenantId: tenantObjectId,
        boardId: boardObjectId,
        actorId: new mongoose_1.default.Types.ObjectId(req.user.id),
        actorName: req.user.name,
        actorEmail: req.user.email,
        entityType: 'COLUMN',
        entityId: column._id.toString(),
        action: 'COLUMN_CREATED',
        details: { name: column.name },
    });
    await (0, eventService_1.recordTenantEvent)(tenantId, 'column.created', { id: req.user.id, name: req.user.name }, { column });
    res.status(201).json({ column });
}
async function updateColumn(req, res) {
    const tenantId = req.tenantId;
    const { columnId } = req.params;
    const data = UpdateColumnSchema.parse(req.body);
    const column = await Column_1.Column.findOne({
        _id: new mongoose_1.default.Types.ObjectId(columnId),
        tenantId: new mongoose_1.default.Types.ObjectId(tenantId),
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
    if (data.name)
        column.name = data.name;
    if (data.color)
        column.color = data.color;
    column.version += 1;
    await column.save();
    await (0, eventService_1.recordTenantEvent)(tenantId, 'column.updated', { id: req.user.id, name: req.user.name }, { column });
    res.json({ column });
}
async function moveColumn(req, res) {
    const tenantId = req.tenantId;
    const { columnId } = req.params;
    const data = MoveColumnSchema.parse(req.body);
    const column = await Column_1.Column.findOne({
        _id: new mongoose_1.default.Types.ObjectId(columnId),
        tenantId: new mongoose_1.default.Types.ObjectId(tenantId),
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
    const newPosition = (0, fractionalIndex_1.generateKeyBetween)(data.beforePosition, data.afterPosition);
    column.position = newPosition;
    column.version += 1;
    await column.save();
    await (0, eventService_1.recordTenantEvent)(tenantId, 'column.moved', { id: req.user.id, name: req.user.name }, { column });
    res.json({ column });
}
async function deleteColumn(req, res) {
    const tenantId = req.tenantId;
    const { columnId } = req.params;
    const columnObjectId = new mongoose_1.default.Types.ObjectId(columnId);
    const tenantObjectId = new mongoose_1.default.Types.ObjectId(tenantId);
    const column = await Column_1.Column.findOneAndDelete({
        _id: columnObjectId,
        tenantId: tenantObjectId,
    });
    if (!column) {
        res.status(404).json({ code: 'column_not_found', message: 'Column not found' });
        return;
    }
    // Soft-delete or mark tasks in this column as deleted
    await Task_1.Task.updateMany({ columnId: columnObjectId, tenantId: tenantObjectId }, { $set: { deletedAt: new Date() } });
    await ActivityLog_1.ActivityLog.create({
        tenantId: tenantObjectId,
        boardId: column.boardId,
        actorId: new mongoose_1.default.Types.ObjectId(req.user.id),
        actorName: req.user.name,
        actorEmail: req.user.email,
        entityType: 'COLUMN',
        entityId: column._id.toString(),
        action: 'COLUMN_DELETED',
        details: { name: column.name },
    });
    await (0, eventService_1.recordTenantEvent)(tenantId, 'column.deleted', { id: req.user.id, name: req.user.name }, { columnId, boardId: column.boardId });
    res.json({ message: 'Column deleted successfully' });
}
