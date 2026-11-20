"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordTenantEvent = recordTenantEvent;
const mongoose_1 = __importDefault(require("mongoose"));
const TenantEvent_1 = require("../models/TenantEvent");
const realtime_1 = require("./realtime");
async function recordTenantEvent(tenantId, type, actor, data) {
    const tenantObjectId = new mongoose_1.default.Types.ObjectId(tenantId.toString());
    // Atomically find max sequence for tenant
    const lastEvent = await TenantEvent_1.TenantEvent.findOne({ tenantId: tenantObjectId })
        .sort({ seq: -1 })
        .select('seq')
        .lean();
    const nextSeq = (lastEvent?.seq ?? 0) + 1;
    const eventDoc = await TenantEvent_1.TenantEvent.create({
        tenantId: tenantObjectId,
        seq: nextSeq,
        type,
        actorId: actor.id,
        actorName: actor.name,
        data,
    });
    // Broadcast to the tenant's WebSocket room
    const io = (0, realtime_1.getSocketIO)();
    if (io) {
        io.to(`tenant:${tenantId.toString()}`).emit(type, {
            seq: nextSeq,
            type,
            actorId: actor.id,
            actorName: actor.name,
            data,
            timestamp: eventDoc.createdAt,
        });
    }
    return nextSeq;
}
