import mongoose, { Document, Schema } from 'mongoose';

export interface IBoard extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  version: number;
  createdBy: mongoose.Types.ObjectId;
  deletedAt?: Date | null;
  deletedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const BoardSchema = new Schema<IBoard>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    version: { type: Number, default: 1, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

// Leading tenantId compound index for strict isolation
BoardSchema.index({ tenantId: 1, _id: 1 });

export const Board = mongoose.model<IBoard>('Board', BoardSchema);
