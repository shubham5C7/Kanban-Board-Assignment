import { Response } from 'express';
import mongoose from 'mongoose';
import { TenantEvent } from '../models/TenantEvent';
import { AuthenticatedRequest } from '../types';

export async function getMissedEvents(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const afterSeq = parseInt((req.query.after as string) || '0', 10);
  const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 500);

  const events = await TenantEvent.find({
    tenantId: new mongoose.Types.ObjectId(tenantId),
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
