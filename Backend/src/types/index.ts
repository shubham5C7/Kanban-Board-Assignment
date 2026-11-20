import { Request } from 'express';

export type UserRole = 'ORG_ADMIN' | 'TENANT_ADMIN' | 'MEMBER';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface TenantMembership {
  id: string;
  userId: string;
  organizationId: string;
  tenantId: string | null;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  tenantId?: string;
  membership?: TenantMembership;
}

export interface ReorderItem {
  id: string;
  position: string;
}

export type ActivityAction =
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_MOVED'
  | 'TASK_DELETED'
  | 'COLUMN_CREATED'
  | 'COLUMN_UPDATED'
  | 'COLUMN_MOVED'
  | 'COLUMN_DELETED'
  | 'BOARD_CREATED'
  | 'BOARD_UPDATED';

export interface PresenceUser {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  tenantId: string;
  boardId?: string;
  activeTaskId?: string;
  lastActive: number;
}
