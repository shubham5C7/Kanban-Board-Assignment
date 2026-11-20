"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActivityLogs = getActivityLogs;
const mongoose_1 = __importDefault(require("mongoose"));
const ActivityLog_1 = require("../models/ActivityLog");
async function getActivityLogs(req, res) {
    const tenantId = req.tenantId;
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const cursor = req.query.cursor;
    const query = {
        tenantId: new mongoose_1.default.Types.ObjectId(tenantId),
    };
    if (cursor && mongoose_1.default.isValidObjectId(cursor)) {
        query._id = { $lt: new mongoose_1.default.Types.ObjectId(cursor) };
    }
    const logs = await ActivityLog_1.ActivityLog.find(query)
        .sort({ _id: -1 })
        .limit(limit + 1)
        .lean();
    const hasMore = logs.length > limit;
    const items = hasMore ? logs.slice(0, limit) : logs;
    const nextCursor = hasMore ? items[items.length - 1]._id.toString() : null;
    res.json({
        logs: items,
        nextCursor,
        hasMore,
    });
}
