"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const tenant_1 = require("../middleware/tenant");
const rbac_1 = require("../middleware/rbac");
const tenantController_1 = require("../controllers/tenantController");
const membershipController_1 = require("../controllers/membershipController");
const boardController_1 = require("../controllers/boardController");
const columnController_1 = require("../controllers/columnController");
const taskController_1 = require("../controllers/taskController");
const activityController_1 = require("../controllers/activityController");
const syncController_1 = require("../controllers/syncController");
const router = (0, express_1.Router)();
// Global auth & tenant resolution for all tenant endpoints
router.use(auth_1.authenticate);
router.use('/:tenantId', tenant_1.resolveTenant);
// Tenant metadata
router.get('/:tenantId', tenantController_1.getTenant);
router.patch('/:tenantId', rbac_1.requireOrgAdmin, tenantController_1.updateTenant);
router.delete('/:tenantId', rbac_1.requireOrgAdmin, tenantController_1.deleteTenant);
// Memberships
router.get('/:tenantId/members', membershipController_1.getMembers);
router.post('/:tenantId/members', rbac_1.requireTenantAdmin, membershipController_1.addMember);
router.patch('/:tenantId/members/:memberId', rbac_1.requireTenantAdmin, membershipController_1.updateMemberRole);
router.delete('/:tenantId/members/:memberId', rbac_1.requireTenantAdmin, membershipController_1.removeMember);
// Boards
router.get('/:tenantId/boards', boardController_1.getBoards);
router.post('/:tenantId/boards', rbac_1.requireTenantAdmin, boardController_1.createBoard);
router.get('/:tenantId/boards/:boardId', boardController_1.getBoard);
router.patch('/:tenantId/boards/:boardId', rbac_1.requireTenantAdmin, boardController_1.updateBoard);
router.delete('/:tenantId/boards/:boardId', rbac_1.requireTenantAdmin, boardController_1.deleteBoard);
// Columns
router.post('/:tenantId/boards/:boardId/columns', rbac_1.requireTenantAdmin, columnController_1.createColumn);
router.patch('/:tenantId/columns/:columnId', rbac_1.requireTenantAdmin, columnController_1.updateColumn);
router.post('/:tenantId/columns/:columnId/move', rbac_1.requireTenantAdmin, columnController_1.moveColumn);
router.delete('/:tenantId/columns/:columnId', rbac_1.requireTenantAdmin, columnController_1.deleteColumn);
// Tasks
router.post('/:tenantId/columns/:columnId/tasks', rbac_1.requireMember, taskController_1.createTask);
router.get('/:tenantId/tasks/:taskId', rbac_1.requireMember, taskController_1.getTask);
router.patch('/:tenantId/tasks/:taskId', rbac_1.requireMember, taskController_1.updateTask);
router.post('/:tenantId/tasks/:taskId/move', rbac_1.requireMember, taskController_1.moveTask);
router.post('/:tenantId/tasks/:taskId/undo', rbac_1.requireMember, taskController_1.undoTask);
router.delete('/:tenantId/tasks/:taskId', rbac_1.requireMember, taskController_1.deleteTask);
// Activity Feed & Reconnection Sync
router.get('/:tenantId/activity', rbac_1.requireMember, activityController_1.getActivityLogs);
router.get('/:tenantId/events', rbac_1.requireMember, syncController_1.getMissedEvents);
exports.default = router;
