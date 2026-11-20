export type UserRole = 'ORG_ADMIN' | 'TENANT_ADMIN' | 'MEMBER';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface User {
  id: string;
  _id?: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface Organization {
  _id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface Tenant {
  _id: string;
  organizationId: string | Organization;
  name: string;
  slug: string;
  createdAt: string;
}

export interface Membership {
  id: string;
  role: UserRole;
  organization: Organization;
  tenant: Tenant | null;
}

export interface Board {
  _id: string;
  tenantId: string;
  name: string;
  description?: string;
  version: number;
  createdBy: User;
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  _id: string;
  tenantId: string;
  boardId: string;
  name: string;
  position: string;
  version: number;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  _id: string;
  tenantId: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  labels: string[];
  dueDate?: string | null;
  position: string;
  version: number;
  assigneeId?: User | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  _id: string;
  tenantId: string;
  boardId?: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  entityType: 'TASK' | 'COLUMN' | 'BOARD' | 'MEMBERSHIP';
  entityId: string;
  action: string;
  details?: Record<string, any>;
  before?: any;
  after?: any;
  createdAt: string;
}

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

export interface FilterState {
  search: string;
  priority: string;
  assigneeId: string;
  label: string;
}

export interface TaskSnapshot {
  columnId?: string;
  position?: string;
  title?: string;
  description?: string;
  priority?: TaskPriority;
  labels?: string[];
  dueDate?: string | null;
  assigneeId?: string | null;
  deletedAt?: string | null;
}

export interface UndoAction {
  taskId: string;
  tenantId: string;
  boardId: string;
  title: string;
  beforeState: TaskSnapshot;
  afterState: TaskSnapshot;
  expectedVersion: number;
  timestamp: number;
}
