import mongoose, { Document, Schema } from 'mongoose';
import { UserRole } from '../types';

export interface IMembership extends Document {
  userId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

const MembershipSchema = new Schema<IMembership>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true },
    role: {
      type: String,
      enum: ['ORG_ADMIN', 'TENANT_ADMIN', 'MEMBER'],
      required: true,
      default: 'MEMBER',
    },
  },
  { timestamps: true }
);

// One user can have one role per tenant (or org-level where tenantId is null)
MembershipSchema.index({ userId: 1, organizationId: 1, tenantId: 1 }, { unique: true });

export const Membership = mongoose.model<IMembership>('Membership', MembershipSchema);
