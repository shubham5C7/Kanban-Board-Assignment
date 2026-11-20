import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User';
import { Membership } from '../models/Membership';
import { Organization } from '../models/Organization';
import { Tenant } from '../models/Tenant';
import { signToken } from '../utils/jwt';
import { AuthenticatedRequest } from '../types';

const RegisterSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().min(2),
  password: z.string().min(6),
  avatarUrl: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string(),
});

export async function register(req: Request, res: Response): Promise<void> {
  const data = RegisterSchema.parse(req.body);
  const existingUser = await User.findOne({ email: data.email.toLowerCase() });
  if (existingUser) {
    res.status(409).json({ code: 'user_exists', message: 'User with this email already exists' });
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(data.password, salt);

  const user = await User.create({
    email: data.email.toLowerCase(),
    name: data.name,
    passwordHash,
    avatarUrl: data.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(data.name)}`,
  });

  const token = signToken({ id: user._id.toString(), email: user.email, name: user.name });

  res.status(201).json({
    token,
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    },
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const data = LoginSchema.parse(req.body);
  const user = await User.findOne({ email: data.email.toLowerCase() });

  if (!user) {
    res.status(401).json({ code: 'invalid_credentials', message: 'Invalid email or password' });
    return;
  }

  const isMatch = await user.comparePassword(data.password);
  if (!isMatch) {
    res.status(401).json({ code: 'invalid_credentials', message: 'Invalid email or password' });
    return;
  }

  const token = signToken({ id: user._id.toString(), email: user.email, name: user.name });

  res.json({
    token,
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    },
  });
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ code: 'unauthorized', message: 'Authentication required' });
    return;
  }

  const user = await User.findById(req.user.id).select('-passwordHash');
  if (!user) {
    res.status(404).json({ code: 'user_not_found', message: 'User not found' });
    return;
  }

  // Find all memberships
  const memberships = await Membership.find({ userId: user._id })
    .populate('organizationId', 'name slug')
    .populate('tenantId', 'name slug organizationId')
    .lean();

  res.json({
    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    },
    memberships: memberships.map(m => ({
      id: m._id.toString(),
      role: m.role,
      organization: m.organizationId,
      tenant: m.tenantId,
    })),
  });
}
