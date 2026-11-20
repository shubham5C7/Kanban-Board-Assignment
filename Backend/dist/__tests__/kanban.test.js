"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = require("../app");
const db_1 = require("../config/db");
const Tenant_1 = require("../models/Tenant");
const Board_1 = require("../models/Board");
const Column_1 = require("../models/Column");
const Task_1 = require("../models/Task");
const TenantEvent_1 = require("../models/TenantEvent");
const ActivityLog_1 = require("../models/ActivityLog");
const fractionalIndex_1 = require("../utils/fractionalIndex");
const app = (0, app_1.createApp)();
let priyaToken;
let arjunToken;
let meeraToken;
let johnToken;
let acmeOrgId;
let globexOrgId;
let acmeNycId;
let acmeLonId;
let globexTkyId;
let boardNycId;
let colTodoId;
let colDoneId;
let sampleTaskId;
(0, vitest_1.beforeAll)(async () => {
    await (0, db_1.connectDB)();
    // Login priya
    const resPriya = await (0, supertest_1.default)(app)
        .post('/api/v1/auth/login')
        .send({ email: 'priya@acme.com', password: 'Password123!' });
    priyaToken = resPriya.body.token;
    // Login arjun
    const resArjun = await (0, supertest_1.default)(app)
        .post('/api/v1/auth/login')
        .send({ email: 'arjun@acme.com', password: 'Password123!' });
    arjunToken = resArjun.body.token;
    // Login meera
    const resMeera = await (0, supertest_1.default)(app)
        .post('/api/v1/auth/login')
        .send({ email: 'meera@acme.com', password: 'Password123!' });
    meeraToken = resMeera.body.token;
    // Login john
    const resJohn = await (0, supertest_1.default)(app)
        .post('/api/v1/auth/login')
        .send({ email: 'john@globex.com', password: 'Password123!' });
    johnToken = resJohn.body.token;
    // Fetch tenants
    const tenantNyc = await Tenant_1.Tenant.findOne({ slug: 'acme-nyc' });
    acmeNycId = tenantNyc._id.toString();
    const tenantLon = await Tenant_1.Tenant.findOne({ slug: 'acme-lon' });
    acmeLonId = tenantLon._id.toString();
    const tenantTky = await Tenant_1.Tenant.findOne({ slug: 'globex-tky' });
    globexTkyId = tenantTky._id.toString();
    const board = await Board_1.Board.findOne({ tenantId: tenantNyc._id });
    boardNycId = board._id.toString();
    const cols = await Column_1.Column.find({ boardId: board._id }).sort({ position: 1 });
    colTodoId = cols[0]._id.toString();
    colDoneId = cols[cols.length - 1]._id.toString();
    const task = await Task_1.Task.findOne({ boardId: board._id, deletedAt: null });
    sampleTaskId = task._id.toString();
});
(0, vitest_1.afterAll)(async () => {
    await mongoose_1.default.disconnect();
});
(0, vitest_1.describe)('1. Authentication & Tenant Membership', () => {
    (0, vitest_1.it)('should authenticate user and return profile with memberships', async () => {
        const res = await (0, supertest_1.default)(app)
            .get('/api/v1/auth/me')
            .set('Authorization', `Bearer ${arjunToken}`);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.user.email).toBe('arjun@acme.com');
        (0, vitest_1.expect)(res.body.memberships.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('should reject unauthenticated requests with 401', async () => {
        const res = await (0, supertest_1.default)(app).get(`/api/v1/tenants/${acmeNycId}/boards`);
        (0, vitest_1.expect)(res.status).toBe(401);
    });
});
(0, vitest_1.describe)('2. Strict Multi-Tenant Isolation & Zero Leakage (Edge Cases)', () => {
    (0, vitest_1.it)('should return 404 (not 403) when a user attempts to access a tenant they do not belong to (anti-enumeration)', async () => {
        // Meera is only member of Acme New York. Attempting to access Globex Tokyo must return 404!
        const res = await (0, supertest_1.default)(app)
            .get(`/api/v1/tenants/${globexTkyId}/boards`)
            .set('Authorization', `Bearer ${meeraToken}`);
        (0, vitest_1.expect)(res.status).toBe(404);
        (0, vitest_1.expect)(res.body.code).toBe('tenant_not_found');
    });
    (0, vitest_1.it)('should return 404 if a user in Tenant A tries to read a Task belonging to Tenant B (cross-tenant ID guessing)', async () => {
        // Create a private task in Acme London
        const boardLon = await Board_1.Board.findOne({ tenantId: new mongoose_1.default.Types.ObjectId(acmeLonId) });
        const colLon = await Column_1.Column.findOne({ boardId: boardLon._id });
        const londonTask = await Task_1.Task.create({
            tenantId: new mongoose_1.default.Types.ObjectId(acmeLonId),
            boardId: boardLon._id,
            columnId: colLon._id,
            title: 'Secret London Task',
            position: 'Z',
            version: 1,
        });
        // Meera (Acme NYC) guesses the taskId under her tenant endpoint
        const res = await (0, supertest_1.default)(app)
            .get(`/api/v1/tenants/${acmeNycId}/tasks/${londonTask._id}`)
            .set('Authorization', `Bearer ${meeraToken}`);
        (0, vitest_1.expect)(res.status).toBe(404);
        (0, vitest_1.expect)(res.body.code).toBe('task_not_found');
    });
    (0, vitest_1.it)('should strictly isolate boards, columns and tasks by tenantId in MongoDB', async () => {
        const res = await (0, supertest_1.default)(app)
            .get(`/api/v1/tenants/${acmeNycId}/boards/${boardNycId}`)
            .set('Authorization', `Bearer ${arjunToken}`);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.board.tenantId.toString()).toBe(acmeNycId);
        // Ensure all columns belong to tenant
        res.body.columns.forEach((c) => {
            (0, vitest_1.expect)(c.tenantId.toString()).toBe(acmeNycId);
        });
        // Ensure all tasks belong to tenant
        res.body.tasks.forEach((t) => {
            (0, vitest_1.expect)(t.tenantId.toString()).toBe(acmeNycId);
        });
    });
});
(0, vitest_1.describe)('3. Role-Based Access Control (RBAC)', () => {
    (0, vitest_1.it)('should allow Tenant Admin to create a column', async () => {
        const res = await (0, supertest_1.default)(app)
            .post(`/api/v1/tenants/${acmeNycId}/boards/${boardNycId}/columns`)
            .set('Authorization', `Bearer ${arjunToken}`)
            .send({ name: 'Testing Column', color: '#8b5cf6' });
        (0, vitest_1.expect)(res.status).toBe(201);
        (0, vitest_1.expect)(res.body.column.name).toBe('Testing Column');
    });
    (0, vitest_1.it)('should forbid Member from creating a column (403 forbidden)', async () => {
        const res = await (0, supertest_1.default)(app)
            .post(`/api/v1/tenants/${acmeNycId}/boards/${boardNycId}/columns`)
            .set('Authorization', `Bearer ${meeraToken}`)
            .send({ name: 'Member Unauthorized Column' });
        (0, vitest_1.expect)(res.status).toBe(403);
        (0, vitest_1.expect)(res.body.code).toBe('forbidden');
    });
    (0, vitest_1.it)('should allow Member to create a task', async () => {
        const res = await (0, supertest_1.default)(app)
            .post(`/api/v1/tenants/${acmeNycId}/columns/${colTodoId}/tasks`)
            .set('Authorization', `Bearer ${meeraToken}`)
            .send({ title: 'Task created by Member', priority: 'MEDIUM' });
        (0, vitest_1.expect)(res.status).toBe(201);
        (0, vitest_1.expect)(res.body.task.title).toBe('Task created by Member');
    });
});
(0, vitest_1.describe)('4. Optimistic Concurrency Control (OCC) & Conflict Resolution', () => {
    (0, vitest_1.it)('should update task successfully when expectedVersion matches current version', async () => {
        const task = await Task_1.Task.findById(sampleTaskId);
        const currentVersion = task.version;
        const res = await (0, supertest_1.default)(app)
            .patch(`/api/v1/tenants/${acmeNycId}/tasks/${sampleTaskId}`)
            .set('Authorization', `Bearer ${meeraToken}`)
            .send({
            title: 'Updated Title by Meera',
            expectedVersion: currentVersion,
        });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.task.title).toBe('Updated Title by Meera');
        (0, vitest_1.expect)(res.body.task.version).toBe(currentVersion + 1);
    });
    (0, vitest_1.it)('should return 409 version_conflict with current record when expectedVersion is stale', async () => {
        const task = await Task_1.Task.findById(sampleTaskId);
        const staleVersion = task.version - 1; // deliberately stale
        const res = await (0, supertest_1.default)(app)
            .patch(`/api/v1/tenants/${acmeNycId}/tasks/${sampleTaskId}`)
            .set('Authorization', `Bearer ${arjunToken}`)
            .send({
            title: 'Conflict Title by Arjun',
            expectedVersion: staleVersion,
        });
        (0, vitest_1.expect)(res.status).toBe(409);
        (0, vitest_1.expect)(res.body.code).toBe('version_conflict');
        (0, vitest_1.expect)(res.body.currentRecord).toBeDefined();
        (0, vitest_1.expect)(res.body.currentRecord.version).toBe(task.version);
    });
    (0, vitest_1.it)('should return 409 column_deleted when moving card onto a deleted/non-existent column', async () => {
        const fakeColumnId = new mongoose_1.default.Types.ObjectId().toString();
        const res = await (0, supertest_1.default)(app)
            .post(`/api/v1/tenants/${acmeNycId}/tasks/${sampleTaskId}/move`)
            .set('Authorization', `Bearer ${meeraToken}`)
            .send({
            targetColumnId: fakeColumnId,
        });
        (0, vitest_1.expect)(res.status).toBe(409);
        (0, vitest_1.expect)(res.body.code).toBe('column_deleted');
    });
});
(0, vitest_1.describe)('5. Fractional Indexing & Ordering', () => {
    (0, vitest_1.it)('should generate valid midpoint between two keys', () => {
        const key1 = (0, fractionalIndex_1.generateKeyBetween)(null, null); // 'U'
        const key2 = (0, fractionalIndex_1.generateKeyBetween)(key1, null);
        const mid = (0, fractionalIndex_1.generateKeyBetween)(key1, key2);
        (0, vitest_1.expect)(key1 < mid).toBe(true);
        (0, vitest_1.expect)(mid < key2).toBe(true);
    });
    (0, vitest_1.it)('should move task to another column and calculate valid fractional position', async () => {
        const task = await Task_1.Task.findById(sampleTaskId);
        const res = await (0, supertest_1.default)(app)
            .post(`/api/v1/tenants/${acmeNycId}/tasks/${sampleTaskId}/move`)
            .set('Authorization', `Bearer ${meeraToken}`)
            .send({
            targetColumnId: colDoneId,
            expectedVersion: task.version,
        });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.task.columnId.toString()).toBe(colDoneId);
        (0, vitest_1.expect)(res.body.undoPayload).toBeDefined();
    });
});
(0, vitest_1.describe)('6. Undo Operations & Stale Undo Protection', () => {
    (0, vitest_1.it)('should successfully undo an action when version matches', async () => {
        const task = await Task_1.Task.findById(sampleTaskId);
        const currentVersion = task.version;
        const res = await (0, supertest_1.default)(app)
            .post(`/api/v1/tenants/${acmeNycId}/tasks/${sampleTaskId}/undo`)
            .set('Authorization', `Bearer ${meeraToken}`)
            .send({
            expectedVersion: currentVersion,
            previousState: {
                columnId: colTodoId,
                title: 'Reverted Title via Undo',
            },
        });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.task.columnId.toString()).toBe(colTodoId);
        (0, vitest_1.expect)(res.body.task.title).toBe('Reverted Title via Undo');
    });
    (0, vitest_1.it)('should reject undo with 409 conflict_undo_stale if entity was modified by another user', async () => {
        const res = await (0, supertest_1.default)(app)
            .post(`/api/v1/tenants/${acmeNycId}/tasks/${sampleTaskId}/undo`)
            .set('Authorization', `Bearer ${meeraToken}`)
            .send({
            expectedVersion: 9999, // stale expected version
            previousState: { title: 'Illegal Undo' },
        });
        (0, vitest_1.expect)(res.status).toBe(409);
        (0, vitest_1.expect)(res.body.code).toBe('conflict_undo_stale');
    });
});
(0, vitest_1.describe)('7. Activity Log & Offline Sync Recovery', () => {
    (0, vitest_1.it)('should append activity logs for tenant mutations', async () => {
        const res = await (0, supertest_1.default)(app)
            .get(`/api/v1/tenants/${acmeNycId}/activity`)
            .set('Authorization', `Bearer ${meeraToken}`);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(Array.isArray(res.body.logs)).toBe(true);
        (0, vitest_1.expect)(res.body.logs.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('should support missed events replay endpoint for reconnecting clients', async () => {
        const res = await (0, supertest_1.default)(app)
            .get(`/api/v1/tenants/${acmeNycId}/events?after=0`)
            .set('Authorization', `Bearer ${meeraToken}`);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(Array.isArray(res.body.events)).toBe(true);
    });
    (0, vitest_1.afterAll)(async () => {
        // Clean up temporary test artifacts, events, and logs so they never pollute the dev database
        await Column_1.Column.deleteMany({ name: { $in: ['Testing Column', 'Member Unauthorized Column'] } });
        await Task_1.Task.deleteMany({ title: 'Task created by Member' });
        await TenantEvent_1.TenantEvent.deleteMany({ 'data.column.name': { $in: ['Testing Column', 'Member Unauthorized Column'] } });
        await ActivityLog_1.ActivityLog.deleteMany({ 'details.name': { $in: ['Testing Column', 'Member Unauthorized Column'] } });
    });
});
