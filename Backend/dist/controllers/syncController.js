"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMissedEvents = getMissedEvents;
const mongoose_1 = __importDefault(require("mongoose"));
const TenantEvent_1 = require("../models/TenantEvent");
async function getMissedEvents(req, res) {
    const tenantId = req.tenantId;
    const afterSeq = parseInt(req.query.after || '0', 10);
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    const events = await TenantEvent_1.TenantEvent.find({
        tenantId: new mongoose_1.default.Types.ObjectId(tenantId),
        seq: { $gt: afterSeq },
    })
        .sort({ seq: 1 })
        .limit(limit)
        .lean();
    const lastEvent = events.length > 0 ? events[events.length - 1] : null;
    res.json({
        events,
        latestSeq: lastEvent ? lastEvent.seq : afterSeq,
        hasMore: events.length === limit,
    });
}
