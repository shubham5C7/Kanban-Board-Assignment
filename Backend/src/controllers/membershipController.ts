import { Response } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Membership } from '../models/Membership';
import { User } from '../models/User';
import { Tenant } from '../models/Tenant';
import { AuthenticatedRequest } from '../types';

const AddMemberSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(['TENANT_ADMIN', 'MEMBER']).default('MEMBER'),
});

const UpdateRoleSchema = z.object({
  role: z.enum(['TENANT_ADMIN', 'MEMBER']),
});

export async function getMembers(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

  const memberships = await Membership.find({ tenantId: tenantObjectId })
    .populate('userId', 'name email avatarUrl')
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    members: memberships.map((m: any) => ({
      id: m._id.toString(),
      role: m.role,
      user: m.userId
        ? {
            id: m.userId._id ? m.userId._id.toString() : m.userId.toString(),
            _id: m.userId._id ? m.userId._id.toString() : m.userId.toString(),
            name: m.userId.name || 'Member',
            email: m.userId.email || '',
            avatarUrl: m.userId.avatarUrl,
          }
        : null,
      createdAt: m.createdAt,
    })),
  });
}

export async function addMember(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const data = AddMemberSchema.parse(req.body);

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    res.status(404).json({ code: 'tenant_not_found', message: 'Tenant not found' });
    return;
  }

  // Find user by email
  let user = await User.findOne({ email: data.email.toLowerCase() });
  if (!user) {
    res.status(404).json({ code: 'user_not_found', message: 'User with this email not found' });
    return;
  }

  // Check if membership already exists in this tenant
  const existing = await Membership.findOne({
    userId: user._id,
    organizationId: tenant.organizationId,
    tenantId: tenant._id,
  });

  if (existing) {
    res.status(409).json({ code: 'member_already_exists', message: 'User is already a member of this tenant' });
    return;
  }

  const membership = await Membership.create({
    userId: user._id,
    organizationId: tenant.organizationId,
    tenantId: tenant._id,
    role: data.role,
  });

  res.status(201).json({
    membership: {
      id: membership._id.toString(),
      role: membership.role,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
    },
  });
}

export async function updateMemberRole(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { memberId } = req.params;
  const data = UpdateRoleSchema.parse(req.body);

  const membership = await Membership.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(memberId), tenantId: new mongoose.Types.ObjectId(tenantId) },
    { $set: { role: data.role } },
    { new: true }
  ).populate('userId', 'name email avatarUrl');

  if (!membership) {
    res.status(404).json({ code: 'member_not_found', message: 'Membership not found' });
    return;
  }

  res.json({ membership });
}

export async function removeMember(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { memberId } = req.params;

  const result = await Membership.findOneAndDelete({
    _id: new mongoose.Types.ObjectId(memberId),
    tenantId: new mongoose.Types.ObjectId(tenantId),
  });

  if (!result) {
    res.status(404).json({ code: 'member_not_found', message: 'Membership not found' });
    return;
  }

  res.json({ message: 'Member removed from tenant' });
}
