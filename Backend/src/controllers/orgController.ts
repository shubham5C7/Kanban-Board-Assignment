import { Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Organization } from '../models/Organization';
import { Membership } from '../models/Membership';
import { Tenant } from '../models/Tenant';
import { AuthenticatedRequest } from '../types';

const CreateOrgSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric with hyphens'),
});

const UpdateOrgSchema = z.object({
  name: z.string().min(2).optional(),
});

export async function getOrganizations(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user!.id;
  const memberships = await Membership.find({ userId: new mongoose.Types.ObjectId(userId) }).lean();
  const orgIds = Array.from(new Set(memberships.map(m => m.organizationId.toString())));

  const organizations = await Organization.find({ _id: { $in: orgIds } }).sort({ createdAt: -1 });
  res.json({ organizations });
}

export async function createOrganization(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = CreateOrgSchema.parse(req.body);
  const userId = req.user!.id;

  const existing = await Organization.findOne({ slug: data.slug.toLowerCase() });
  if (existing) {
    res.status(409).json({ code: 'org_slug_exists', message: 'Organization slug already taken' });
    return;
  }

  const org = await Organization.create({
    name: data.name,
    slug: data.slug.toLowerCase(),
  });

  // Assign user as ORG_ADMIN
  await Membership.create({
    userId: new mongoose.Types.ObjectId(userId),
    organizationId: org._id,
    tenantId: null,
    role: 'ORG_ADMIN',
  });

  res.status(201).json({ organization: org });
}

export async function getOrganization(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { orgId } = req.params;
  const userId = req.user!.id;

  if (!mongoose.isValidObjectId(orgId)) {
    res.status(404).json({ code: 'org_not_found', message: 'Organization not found' });
    return;
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const orgObjectId = new mongoose.Types.ObjectId(orgId);
  const orgAdmin = await Membership.findOne({
    userId: userObjectId,
    organizationId: orgObjectId,
    tenantId: null,
    role: 'ORG_ADMIN',
  });
  const tenantMemberships = await Membership.find({
    userId: userObjectId,
    organizationId: orgObjectId,
    tenantId: { $ne: null },
  }).lean();

  if (!orgAdmin && tenantMemberships.length === 0) {
    res.status(404).json({ code: 'org_not_found', message: 'Organization not found' });
    return;
  }

  const org = await Organization.findById(orgId);
  if (!org) {
    res.status(404).json({ code: 'org_not_found', message: 'Organization not found' });
    return;
  }

  const tenantFilter = orgAdmin
    ? { organizationId: org._id }
    : { _id: { $in: tenantMemberships.map((membership) => membership.tenantId) } };
  const tenants = await Tenant.find(tenantFilter).sort({ name: 1 });
  res.json({ organization: org, tenants });
}

export async function updateOrganization(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { orgId } = req.params;
  const userId = req.user!.id;
  const data = UpdateOrgSchema.parse(req.body);

  const membership = await Membership.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    organizationId: new mongoose.Types.ObjectId(orgId),
    role: 'ORG_ADMIN',
  });

  if (!membership) {
    res.status(403).json({ code: 'forbidden', message: 'Org Admin privileges required' });
    return;
  }

  const org = await Organization.findByIdAndUpdate(orgId, { $set: data }, { new: true });
  if (!org) {
    res.status(404).json({ code: 'org_not_found', message: 'Organization not found' });
    return;
  }

  res.json({ organization: org });
}

export async function deleteOrganization(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { orgId } = req.params;
  const userId = req.user!.id;

  const membership = await Membership.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    organizationId: new mongoose.Types.ObjectId(orgId),
    role: 'ORG_ADMIN',
  });

  if (!membership) {
    res.status(403).json({ code: 'forbidden', message: 'Org Admin privileges required' });
    return;
  }

  await Organization.findByIdAndDelete(orgId);
  await Tenant.deleteMany({ organizationId: new mongoose.Types.ObjectId(orgId) });
  await Membership.deleteMany({ organizationId: new mongoose.Types.ObjectId(orgId) });

  res.json({ message: 'Organization deleted successfully' });
}
