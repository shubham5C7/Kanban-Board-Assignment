import { Response } from 'express';
import mongoose from 'mongoose';
import { ActivityLog } from '../models/ActivityLog';
import { AuthenticatedRequest } from '../types';

export async function getActivityLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 100);
  const cursor = req.query.cursor as string;

  const query: any = {
    tenantId: new mongoose.Types.ObjectId(tenantId),
  };

  if (cursor && mongoose.isValidObjectId(cursor)) {
    query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }

  const logs = await ActivityLog.find(query)
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
