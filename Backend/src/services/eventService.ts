import mongoose from 'mongoose';
import { TenantEvent } from '../models/TenantEvent';
import { Tenant } from '../models/Tenant';
import { getSocketIO } from './realtime';

export async function recordTenantEvent(
  tenantId: string | mongoose.Types.ObjectId,
  type: string,
  actor: { id: string; name: string },
  data: any
): Promise<number> {
  const tenantObjectId = new mongoose.Types.ObjectId(tenantId.toString());

  // Repair the counter floor from the indexed event stream. This also migrates
  // tenants whose eventSeq field predates the counter, while keeping concurrent
  // allocations atomic on the tenant document.
  const latestEvent = await TenantEvent.findOne({ tenantId: tenantObjectId })
    .sort({ seq: -1 })
    .select('seq')
    .lean();
  const eventFloor = latestEvent?.seq ?? 0;
  const tenant = await Tenant.findOneAndUpdate(
    { _id: tenantObjectId },
    [{
      $set: {
        eventSeq: {
          $add: [
            { $max: [{ $ifNull: ['$eventSeq', 0] }, eventFloor] },
            1,
          ],
        },
      },
    }],
    { new: true, projection: { eventSeq: 1 } }
  ).lean();
  if (!tenant) throw new Error('Tenant not found while recording event');
  const nextSeq = tenant.eventSeq;

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
