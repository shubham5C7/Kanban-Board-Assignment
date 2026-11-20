import mongoose, { Document, Schema } from 'mongoose';

export interface ITenantEvent extends Document {
  tenantId: mongoose.Types.ObjectId;
  seq: number;
  type: string;
  actorId: string;
  actorName: string;
  data: any;
  createdAt: Date;
}

const TenantEventSchema = new Schema<ITenantEvent>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    seq: { type: Number, required: true },
    type: { type: String, required: true },
    actorId: { type: String, required: true },
    actorName: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

TenantEventSchema.index({ tenantId: 1, seq: 1 }, { unique: true });

export const TenantEvent = mongoose.model<ITenantEvent>('TenantEvent', TenantEventSchema);
