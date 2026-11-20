import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app';
import { connectDB } from '../config/db';
import { User } from '../models/User';
import { Organization } from '../models/Organization';
import { Tenant } from '../models/Tenant';
import { Membership } from '../models/Membership';
import { Board } from '../models/Board';
import { Column } from '../models/Column';
import { Task } from '../models/Task';
import { TenantEvent } from '../models/TenantEvent';
import { ActivityLog } from '../models/ActivityLog';
import { generateKeyBetween } from '../utils/fractionalIndex';

const app = createApp();

let priyaToken: string;
let arjunToken: string;
let meeraToken: string;
let johnToken: string;

let acmeOrgId: string;
let globexOrgId: string;
let acmeNycId: string;
let acmeLonId: string;
let globexTkyId: string;

let boardNycId: string;
let colTodoId: string;
let colDoneId: string;
let sampleTaskId: string;

beforeAll(async () => {
  await connectDB();

  // Login priya
  const resPriya = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'priya@acme.com', password: 'Password123!' });
  priyaToken = resPriya.body.token;

  // Login arjun
  const resArjun = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'arjun@acme.com', password: 'Password123!' });
  arjunToken = resArjun.body.token;

  // Login meera
  const resMeera = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'meera@acme.com', password: 'Password123!' });
  meeraToken = resMeera.body.token;

  // Login john
  const resJohn = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'john@globex.com', password: 'Password123!' });
  johnToken = resJohn.body.token;

  // Fetch tenants
  const tenantNyc = await Tenant.findOne({ slug: 'acme-nyc' });
  acmeNycId = tenantNyc!._id.toString();

  const tenantLon = await Tenant.findOne({ slug: 'acme-lon' });
  acmeLonId = tenantLon!._id.toString();

  const tenantTky = await Tenant.findOne({ slug: 'globex-tky' });
  globexTkyId = tenantTky!._id.toString();

  const board = await Board.findOne({ tenantId: tenantNyc!._id });
  boardNycId = board!._id.toString();

  const cols = await Column.find({ boardId: board!._id }).sort({ position: 1 });
  colTodoId = cols[0]._id.toString();
  colDoneId = cols[cols.length - 1]._id.toString();

  const task = await Task.findOne({ boardId: board!._id, deletedAt: null });
  sampleTaskId = task!._id.toString();
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('1. Authentication & Tenant Membership', () => {
  it('should authenticate user and return profile with memberships', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${arjunToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('arjun@acme.com');
    expect(res.body.memberships.length).toBeGreaterThan(0);
  });

  it('should reject unauthenticated requests with 401', async () => {
    const res = await request(app).get(`/api/v1/tenants/${acmeNycId}/boards`);
    expect(res.status).toBe(401);
  });
});

describe('2. Strict Multi-Tenant Isolation & Zero Leakage (Edge Cases)', () => {
  it('should return 404 (not 403) when a user attempts to access a tenant they do not belong to (anti-enumeration)', async () => {
    // Meera is only member of Acme New York. Attempting to access Globex Tokyo must return 404!
    const res = await request(app)
      .get(`/api/v1/tenants/${globexTkyId}/boards`)
      .set('Authorization', `Bearer ${meeraToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('tenant_not_found');
  });

  it('should return 404 if a user in Tenant A tries to read a Task belonging to Tenant B (cross-tenant ID guessing)', async () => {
    // Create a private task in Acme London
    const boardLon = await Board.findOne({ tenantId: new mongoose.Types.ObjectId(acmeLonId) });
    const colLon = await Column.findOne({ boardId: boardLon!._id });
    const londonTask = await Task.create({
      tenantId: new mongoose.Types.ObjectId(acmeLonId),
      boardId: boardLon!._id,
      columnId: colLon!._id,
      title: 'Secret London Task',
      position: 'Z',
      version: 1,
    });

    // Meera (Acme NYC) guesses the taskId under her tenant endpoint
    const res = await request(app)
      .get(`/api/v1/tenants/${acmeNycId}/tasks/${londonTask._id}`)
      .set('Authorization', `Bearer ${meeraToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('task_not_found');
  });

  it('should strictly isolate boards, columns and tasks by tenantId in MongoDB', async () => {
    const res = await request(app)
      .get(`/api/v1/tenants/${acmeNycId}/boards/${boardNycId}`)
      .set('Authorization', `Bearer ${arjunToken}`);

    expect(res.status).toBe(200);
    expect(res.body.board.tenantId.toString()).toBe(acmeNycId);

    // Ensure all columns belong to tenant
    res.body.columns.forEach((c: any) => {
      expect(c.tenantId.toString()).toBe(acmeNycId);
    });

    // Ensure all tasks belong to tenant
    res.body.tasks.forEach((t: any) => {
      expect(t.tenantId.toString()).toBe(acmeNycId);
    });
  });
});

describe('3. Role-Based Access Control (RBAC)', () => {
  it('should allow Tenant Admin to create a column', async () => {
    const res = await request(app)
      .post(`/api/v1/tenants/${acmeNycId}/boards/${boardNycId}/columns`)
      .set('Authorization', `Bearer ${arjunToken}`)
      .send({ name: 'Testing Column', color: '#8b5cf6' });

    expect(res.status).toBe(201);
    expect(res.body.column.name).toBe('Testing Column');
  });

  it('should forbid Member from creating a column (403 forbidden)', async () => {
    const res = await request(app)
      .post(`/api/v1/tenants/${acmeNycId}/boards/${boardNycId}/columns`)
      .set('Authorization', `Bearer ${meeraToken}`)
      .send({ name: 'Member Unauthorized Column' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('forbidden');
  });

  it('should allow Member to create a task', async () => {
    const res = await request(app)
      .post(`/api/v1/tenants/${acmeNycId}/columns/${colTodoId}/tasks`)
      .set('Authorization', `Bearer ${meeraToken}`)
      .send({ title: 'Task created by Member', priority: 'MEDIUM' });

    expect(res.status).toBe(201);
    expect(res.body.task.title).toBe('Task created by Member');
  });
});

describe('4. Optimistic Concurrency Control (OCC) & Conflict Resolution', () => {
  it('should update task successfully when expectedVersion matches current version', async () => {
    const task = await Task.findById(sampleTaskId);
    const currentVersion = task!.version;

    const res = await request(app)
      .patch(`/api/v1/tenants/${acmeNycId}/tasks/${sampleTaskId}`)
      .set('Authorization', `Bearer ${meeraToken}`)
      .send({
        title: 'Updated Title by Meera',
        expectedVersion: currentVersion,
      });

    expect(res.status).toBe(200);
    expect(res.body.task.title).toBe('Updated Title by Meera');
    expect(res.body.task.version).toBe(currentVersion + 1);
  });

  it('should return 409 version_conflict with current record when expectedVersion is stale', async () => {
    const task = await Task.findById(sampleTaskId);
    const staleVersion = task!.version - 1; // deliberately stale

    const res = await request(app)
      .patch(`/api/v1/tenants/${acmeNycId}/tasks/${sampleTaskId}`)
      .set('Authorization', `Bearer ${arjunToken}`)
      .send({
        title: 'Conflict Title by Arjun',
        expectedVersion: staleVersion,
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('version_conflict');
    expect(res.body.currentRecord).toBeDefined();
    expect(res.body.currentRecord.version).toBe(task!.version);
  });

  it('should return 409 column_deleted when moving card onto a deleted/non-existent column', async () => {
    const fakeColumnId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .post(`/api/v1/tenants/${acmeNycId}/tasks/${sampleTaskId}/move`)
      .set('Authorization', `Bearer ${meeraToken}`)
      .send({
        targetColumnId: fakeColumnId,
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('column_deleted');
  });
});

describe('5. Fractional Indexing & Ordering', () => {
  it('should generate valid midpoint between two keys', () => {
    const key1 = generateKeyBetween(null, null); // 'U'
    const key2 = generateKeyBetween(key1, null);
    const mid = generateKeyBetween(key1, key2);

    expect(key1 < mid).toBe(true);
    expect(mid < key2).toBe(true);
  });

  it('should move task to another column and calculate valid fractional position', async () => {
    const task = await Task.findById(sampleTaskId);
    const res = await request(app)
      .post(`/api/v1/tenants/${acmeNycId}/tasks/${sampleTaskId}/move`)
      .set('Authorization', `Bearer ${meeraToken}`)
      .send({
        targetColumnId: colDoneId,
        expectedVersion: task!.version,
      });

    expect(res.status).toBe(200);
    expect(res.body.task.columnId.toString()).toBe(colDoneId);
    expect(res.body.undoPayload).toBeDefined();
  });
});

describe('6. Undo Operations & Stale Undo Protection', () => {
  it('should successfully undo an action when version matches', async () => {
    const task = await Task.findById(sampleTaskId);
    const currentVersion = task!.version;

    const res = await request(app)
      .post(`/api/v1/tenants/${acmeNycId}/tasks/${sampleTaskId}/undo`)
      .set('Authorization', `Bearer ${meeraToken}`)
      .send({
        expectedVersion: currentVersion,
        previousState: {
          columnId: colTodoId,
          title: 'Reverted Title via Undo',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.task.columnId.toString()).toBe(colTodoId);
    expect(res.body.task.title).toBe('Reverted Title via Undo');
  });

  it('should reject undo with 409 conflict_undo_stale if entity was modified by another user', async () => {
    const res = await request(app)
      .post(`/api/v1/tenants/${acmeNycId}/tasks/${sampleTaskId}/undo`)
      .set('Authorization', `Bearer ${meeraToken}`)
      .send({
        expectedVersion: 9999, // stale expected version
        previousState: { title: 'Illegal Undo' },
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('conflict_undo_stale');
  });
});

describe('7. Activity Log & Offline Sync Recovery', () => {
  it('should append activity logs for tenant mutations', async () => {
    const res = await request(app)
      .get(`/api/v1/tenants/${acmeNycId}/activity`)
      .set('Authorization', `Bearer ${meeraToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.logs)).toBe(true);
    expect(res.body.logs.length).toBeGreaterThan(0);
  });

  it('should support missed events replay endpoint for reconnecting clients', async () => {
    const res = await request(app)
      .get(`/api/v1/tenants/${acmeNycId}/events?after=0`)
      .set('Authorization', `Bearer ${meeraToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
  });

  afterAll(async () => {
    // Clean up temporary test artifacts, events, and logs so they never pollute the dev database
    await Column.deleteMany({ name: { $in: ['Testing Column', 'Member Unauthorized Column'] } });
    await Task.deleteMany({ title: 'Task created by Member' });
    await TenantEvent.deleteMany({ 'data.column.name': { $in: ['Testing Column', 'Member Unauthorized Column'] } });
    await ActivityLog.deleteMany({ 'details.name': { $in: ['Testing Column', 'Member Unauthorized Column'] } });
  });
});
