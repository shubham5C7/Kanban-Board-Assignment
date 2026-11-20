import mongoose, { Document, Schema } from 'mongoose';
import { TaskPriority } from '../types';

export interface ITask extends Document {
  tenantId: mongoose.Types.ObjectId;
  boardId: mongoose.Types.ObjectId;
  columnId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  assigneeId?: mongoose.Types.ObjectId | null;
  priority: TaskPriority;
  labels: string[];
  dueDate?: Date | null;
  position: string;
  version: number;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    boardId: { type: Schema.Types.ObjectId, ref: 'Board', required: true, index: true },
    columnId: { type: Schema.Types.ObjectId, ref: 'Column', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },
    labels: { type: [String], default: [] },
    dueDate: { type: Date, default: null },
    position: { type: String, required: true },
    version: { type: Number, default: 1, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

// Composite indexes leading with tenantId for strict tenant isolation & performance
TaskSchema.index({ tenantId: 1, columnId: 1, position: 1 });
TaskSchema.index({ tenantId: 1, boardId: 1 });
TaskSchema.index({ tenantId: 1, _id: 1 });

export const Task = mongoose.model<ITask>('Task', TaskSchema);
