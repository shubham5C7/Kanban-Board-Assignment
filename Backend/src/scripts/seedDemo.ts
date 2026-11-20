import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { ENV } from '../config/env';
import { User } from '../models/User';
import { Organization } from '../models/Organization';
import { Tenant } from '../models/Tenant';
import { Membership } from '../models/Membership';
import { Board } from '../models/Board';
import { Column } from '../models/Column';
import { Task } from '../models/Task';
import { generateKeyBetween } from '../utils/fractionalIndex';

async function run() {
  if (ENV.NODE_ENV === 'production') throw new Error('Refusing to seed demo accounts in production.');
  await mongoose.connect(ENV.MONGODB_URI);
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const users = new Map<string, any>();
  for (const [email, name] of [
    ['arjun@acme.com', 'Arjun Mehta'],
    ['meera@acme.com', 'Meera Patel'],
    ['priya@acme.com', 'Priya Sharma'],
    ['david@acme.com', 'David Smith'],
    ['john@globex.com', 'John Doe'],
  ]) {
    users.set(email, await User.findOneAndUpdate(
      { email },
      { $set: { name, passwordHash } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ));
  }

  const acme = await Organization.findOneAndUpdate(
    { slug: 'acme-corp' },
    { $setOnInsert: { name: 'Acme Corporation', slug: 'acme-corp' } },
    { upsert: true, new: true }
  );
  const globex = await Organization.findOneAndUpdate(
    { slug: 'globex' },
    { $setOnInsert: { name: 'Globex', slug: 'globex' } },
    { upsert: true, new: true }
  );
  const tenants = new Map<string, any>();
  for (const [key, organization, name, slug] of [
    ['acme-nyc', acme, 'Acme New York', 'acme-nyc'],
    ['acme-lon', acme, 'Acme London', 'acme-lon'],
    ['globex-tky', globex, 'Globex Tokyo', 'globex-tky'],
  ] as const) {
    tenants.set(key, await Tenant.findOneAndUpdate(
      { organizationId: organization._id, slug },
      { $setOnInsert: { organizationId: organization._id, name, slug } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ));
  }

  const memberships = [
    [users.get('priya@acme.com'), acme, null, 'ORG_ADMIN'],
    [users.get('arjun@acme.com'), acme, tenants.get('acme-nyc'), 'TENANT_ADMIN'],
    [users.get('meera@acme.com'), acme, tenants.get('acme-nyc'), 'MEMBER'],
    [users.get('david@acme.com'), acme, tenants.get('acme-lon'), 'TENANT_ADMIN'],
    [users.get('john@globex.com'), globex, null, 'ORG_ADMIN'],
  ] as const;
  for (const [user, organization, tenant, role] of memberships) {
    await Membership.findOneAndUpdate(
      { userId: user._id, organizationId: organization._id, tenantId: tenant?._id ?? null },
      { $setOnInsert: { userId: user._id, organizationId: organization._id, tenantId: tenant?._id ?? null, role } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  for (const [tenantName, tenant] of tenants) {
    let board = await Board.findOne({ tenantId: tenant._id, name: `${tenantName} Board` });
    if (!board) {
      const creator = tenantName === 'acme-nyc' ? users.get('arjun@acme.com') : tenantName === 'acme-lon' ? users.get('david@acme.com') : users.get('john@globex.com');
      board = await Board.create({ tenantId: tenant._id, name: `${tenantName} Board`, description: 'Shared demo board', version: 1, createdBy: creator._id });
    }
    let columns = await Column.find({ tenantId: tenant._id, boardId: board._id }).sort({ position: 1 });
    if (columns.length === 0) {
      let position: string | null = null;
      for (const name of ['To Do', 'In Progress', 'Done']) {
        position = generateKeyBetween(position, null);
        columns.push(await Column.create({ tenantId: tenant._id, boardId: board._id, name, color: '#64748b', position, version: 1 }));
      }
    }
    if (await Task.countDocuments({ tenantId: tenant._id, boardId: board._id }) === 0) {
      await Task.create({ tenantId: tenant._id, boardId: board._id, columnId: columns[0]._id, title: 'Welcome to your shared board', description: 'Drag this card between columns to try the workflow.', position: generateKeyBetween(null, null), version: 1 });
    }
  }

  console.log('Demo workspace ready. Demo password: Password123!');
  await mongoose.disconnect();
}

run().catch(async error => {
  console.error('[Seed demo]', error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
