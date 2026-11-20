import mongoose from 'mongoose';
import { TenantEvent } from '../models/TenantEvent';
import { getSocketIO } from './realtime';

export async function recordTenantEvent(
  tenantId: string | mongoose.Types.ObjectId,
  type: string,
  actor: { id: string; name: string },
  data: any
): Promise<number> {
  const tenantObjectId = new mongoose.Types.ObjectId(tenantId.toString());

  // Atomically find max sequence for tenant
  const lastEvent = await TenantEvent.findOne({ tenantId: tenantObjectId })
    .sort({ seq: -1 })
    .select('seq')
    .lean();

  const nextSeq = (lastEvent?.seq ?? 0) + 1;

  const eventDoc = await TenantEvent.create({
    tenantId: tenantObjectId,
    seq: nextSeq,
    type,
    actorId: actor.id,
    actorName: actor.name,
    data,
  });

  // Broadcast to the tenant's WebSocket room
  const io = getSocketIO();
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
