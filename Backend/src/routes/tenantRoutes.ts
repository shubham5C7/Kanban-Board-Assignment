import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { requireOrgAdmin, requireTenantAdmin, requireMember } from '../middleware/rbac';
import { getTenant, updateTenant, deleteTenant } from '../controllers/tenantController';
import {
  getMembers,
  addMember,
  updateMemberRole,
  removeMember,
} from '../controllers/membershipController';
import {
  getBoards,
  getBoard,
  createBoard,
  updateBoard,
  deleteBoard,
} from '../controllers/boardController';
import {
  createColumn,
  updateColumn,
  moveColumn,
  deleteColumn,
} from '../controllers/columnController';
import {
  createTask,
  getTask,
  updateTask,
  moveTask,
  deleteTask,
  undoTask,
} from '../controllers/taskController';
import { getActivityLogs } from '../controllers/activityController';
import { getMissedEvents } from '../controllers/syncController';

const router = Router();

// Global auth & tenant resolution for all tenant endpoints
router.use(authenticate);
router.use('/:tenantId', resolveTenant);

// Tenant metadata
router.get('/:tenantId', getTenant);
router.patch('/:tenantId', requireOrgAdmin, updateTenant);
router.delete('/:tenantId', requireOrgAdmin, deleteTenant);

// Memberships
router.get('/:tenantId/members', getMembers);
router.post('/:tenantId/members', requireTenantAdmin, addMember);
router.patch('/:tenantId/members/:memberId', requireTenantAdmin, updateMemberRole);
router.delete('/:tenantId/members/:memberId', requireTenantAdmin, removeMember);

// Boards
router.get('/:tenantId/boards', getBoards);
router.post('/:tenantId/boards', requireTenantAdmin, createBoard);
router.get('/:tenantId/boards/:boardId', getBoard);
router.patch('/:tenantId/boards/:boardId', requireTenantAdmin, updateBoard);
router.delete('/:tenantId/boards/:boardId', requireMember, deleteBoard);

// Columns
router.post('/:tenantId/boards/:boardId/columns', requireTenantAdmin, createColumn);
router.patch('/:tenantId/columns/:columnId', requireTenantAdmin, updateColumn);
router.post('/:tenantId/columns/:columnId/move', requireTenantAdmin, moveColumn);
router.delete('/:tenantId/columns/:columnId', requireTenantAdmin, deleteColumn);

// Tasks
router.post('/:tenantId/columns/:columnId/tasks', requireMember, createTask);
router.get('/:tenantId/tasks/:taskId', requireMember, getTask);
router.patch('/:tenantId/tasks/:taskId', requireMember, updateTask);
router.post('/:tenantId/tasks/:taskId/move', requireMember, moveTask);
router.post('/:tenantId/tasks/:taskId/undo', requireMember, undoTask);
router.delete('/:tenantId/tasks/:taskId', requireMember, deleteTask);

// Activity Feed & Reconnection Sync
router.get('/:tenantId/activity', requireMember, getActivityLogs);
router.get('/:tenantId/events', requireMember, getMissedEvents);

export default router;
