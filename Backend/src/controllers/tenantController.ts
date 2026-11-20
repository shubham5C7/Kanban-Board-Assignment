import { Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Tenant } from '../models/Tenant';
import { Membership } from '../models/Membership';
import { Board } from '../models/Board';
import { Column } from '../models/Column';
import { Task } from '../models/Task';
import { ActivityLog } from '../models/ActivityLog';
import { AuthenticatedRequest } from '../types';

const CreateTenantSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric with hyphens'),
});

const UpdateTenantSchema = z.object({
  name: z.string().min(2).optional(),
});

export async function getTenantsInOrg(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { orgId } = req.params;
  const userId = req.user!.id;

  if (!mongoose.isValidObjectId(orgId)) {
    res.status(404).json({ code: 'org_not_found', message: 'Organization not found' });
    return;
  }

  // Check if user has membership in org
  const orgMembership = await Membership.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    organizationId: new mongoose.Types.ObjectId(orgId),
  });

  if (!orgMembership) {
    res.status(404).json({ code: 'org_not_found', message: 'Organization not found' });
    return;
  }

  // If org admin, can see all tenants in this org
  if (orgMembership.role === 'ORG_ADMIN') {
    const tenants = await Tenant.find({ organizationId: new mongoose.Types.ObjectId(orgId) }).sort({ name: 1 });
    res.json({ tenants });
    return;
  }

  // Otherwise, only tenants where user has specific membership
  const memberships = await Membership.find({
    userId: new mongoose.Types.ObjectId(userId),
    organizationId: new mongoose.Types.ObjectId(orgId),
    tenantId: { $ne: null },
  }).lean();

  const tenantIds = memberships.map(m => m.tenantId);
  const tenants = await Tenant.find({ _id: { $in: tenantIds } }).sort({ name: 1 });
  res.json({ tenants });
}

export async function createTenant(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { orgId } = req.params;
  const userId = req.user!.id;
  const data = CreateTenantSchema.parse(req.body);

  // Require ORG_ADMIN for tenant creation
  const orgAdminMembership = await Membership.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    organizationId: new mongoose.Types.ObjectId(orgId),
    role: 'ORG_ADMIN',
  });

  if (!orgAdminMembership) {
    res.status(403).json({ code: 'forbidden', message: 'Only Org Admin can create tenants' });
    return;
  }

  const existing = await Tenant.findOne({
    organizationId: new mongoose.Types.ObjectId(orgId),
    slug: data.slug.toLowerCase(),
  });

  if (existing) {
    res.status(409).json({ code: 'tenant_slug_exists', message: 'Tenant slug already exists in this organization' });
    return;
  }

  const tenant = await Tenant.create({
    organizationId: new mongoose.Types.ObjectId(orgId),
    name: data.name,
    slug: data.slug.toLowerCase(),
  });

  // Automatically grant tenant admin to creator
  await Membership.create({
    userId: new mongoose.Types.ObjectId(userId),
    organizationId: new mongoose.Types.ObjectId(orgId),
    tenantId: tenant._id,
    role: 'TENANT_ADMIN',
  });

  res.status(201).json({ tenant });
}

export async function getTenant(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenant = await Tenant.findById(req.tenantId).populate('organizationId', 'name slug');
  if (!tenant) {
    res.status(404).json({ code: 'tenant_not_found', message: 'Tenant not found' });
    return;
  }

  res.json({
    tenant,
    role: req.membership?.role,
  });
}

export async function updateTenant(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = UpdateTenantSchema.parse(req.body);
  const tenant = await Tenant.findByIdAndUpdate(req.tenantId, { $set: data }, { new: true });
  res.json({ tenant });
}

export async function deleteTenant(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

  await Tenant.findByIdAndDelete(tenantId);
  await Board.deleteMany({ tenantId: tenantObjectId });
  await Column.deleteMany({ tenantId: tenantObjectId });
  await Task.deleteMany({ tenantId: tenantObjectId });
  await ActivityLog.deleteMany({ tenantId: tenantObjectId });
  await Membership.deleteMany({ tenantId: tenantObjectId });

  res.json({ message: 'Tenant deleted successfully' });
}
