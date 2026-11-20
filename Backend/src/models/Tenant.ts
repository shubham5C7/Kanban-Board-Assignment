import mongoose, { Document, Schema } from 'mongoose';

export interface ITenant extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  eventSeq: number;
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema = new Schema<ITenant>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    eventSeq: { type: Number, default: 0, required: true },
  },
  { timestamps: true }
);

TenantSchema.index({ organizationId: 1, slug: 1 }, { unique: true });

export const Tenant = mongoose.model<ITenant>('Tenant', TenantSchema);
