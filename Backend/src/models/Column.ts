import mongoose, { Document, Schema } from 'mongoose';

export interface IColumn extends Document {
  tenantId: mongoose.Types.ObjectId;
  boardId: mongoose.Types.ObjectId;
  name: string;
  position: string;
  version: number;
  color?: string;
  deletedAt?: Date | null;
  deletedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const ColumnSchema = new Schema<IColumn>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    boardId: { type: Schema.Types.ObjectId, ref: 'Board', required: true, index: true },
    name: { type: String, required: true, trim: true },
    position: { type: String, required: true },
    version: { type: Number, default: 1, required: true },
    color: { type: String, default: '#64748b' },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

// Composite index leading with tenantId for strict tenant-level isolation
ColumnSchema.index({ tenantId: 1, boardId: 1, position: 1 });
ColumnSchema.index({ tenantId: 1, _id: 1 });

export const Column = mongoose.model<IColumn>('Column', ColumnSchema);
