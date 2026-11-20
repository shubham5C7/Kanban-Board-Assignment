import mongoose, { Document, Schema } from 'mongoose';
import { ActivityAction } from '../types';

export interface IActivityLog extends Document {
  tenantId: mongoose.Types.ObjectId;
  boardId?: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId;
  actorName: string;
  actorEmail: string;
  entityType: 'TASK' | 'COLUMN' | 'BOARD' | 'MEMBERSHIP';
  entityId: string;
  action: ActivityAction;
  details?: Record<string, any>;
  before?: any;
  after?: any;
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    boardId: { type: Schema.Types.ObjectId, ref: 'Board', index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorName: { type: String, required: true },
    actorEmail: { type: String, required: true },
    entityType: {
      type: String,
      enum: ['TASK', 'COLUMN', 'BOARD', 'MEMBERSHIP'],
      required: true,
    },
    entityId: { type: String, required: true },
    action: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Append-only audit log, queried by tenant in reverse chronological order
ActivityLogSchema.index({ tenantId: 1, createdAt: -1 });

export const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);
