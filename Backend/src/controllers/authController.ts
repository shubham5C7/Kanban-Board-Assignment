import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { z } from 'zod';
import { User } from '../models/User';
import { Membership } from '../models/Membership';
import { Organization } from '../models/Organization';
import { Tenant } from '../models/Tenant';
import { signToken } from '../utils/jwt';
import { AuthenticatedRequest } from '../types';
import { ENV } from '../config/env';
import { isMailConfigured, sendPasswordResetEmail } from '../services/mailer';

const RegisterSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(2),
  password: z.string().min(8),
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

  let organization: any;
  let tenant: any;
  try {
    const baseSlug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'workspace';
    organization = await Organization.create({
      name: `${data.name.trim()}'s Workspace`,
      slug: `${baseSlug}-${randomUUID().slice(0, 8)}`,
    });
    tenant = await Tenant.create({ organizationId: organization._id, name: 'Main Branch', slug: 'main' });
    await Membership.create([
      { userId: user._id, organizationId: organization._id, tenantId: null, role: 'ORG_ADMIN' },
      { userId: user._id, organizationId: organization._id, tenantId: tenant._id, role: 'TENANT_ADMIN' },
    ]);
  } catch (err) {
    await Membership.deleteMany({ userId: user._id });
    if (tenant) await Tenant.deleteOne({ _id: tenant._id });
    if (organization) await Organization.deleteOne({ _id: organization._id });
    await User.deleteOne({ _id: user._id });
    throw err;
  }

  const token = signToken({ id: user._id.toString(), email: user.email, name: user.name }, true);

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
  const data = LoginSchema.extend({ rememberMe: z.boolean().optional().default(false) }).parse(req.body);
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

  const token = signToken({ id: user._id.toString(), email: user.email, name: user.name }, data.rememberMe);

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

const PasswordResetRequestSchema = z.object({ email: z.string().trim().email() });
const PasswordResetConfirmSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8),
});

export async function requestPasswordReset(req: Request, res: Response): Promise<void> {
  const { email } = PasswordResetRequestSchema.parse(req.body);
  if (!isMailConfigured() && ENV.NODE_ENV === 'production') {
    res.status(503).json({ code: 'email_not_configured', message: 'Password reset email is temporarily unavailable.' });
    return;
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  const response: { message: string; resetToken?: string } = {
    message: 'If an account exists for that email, password reset instructions have been sent.',
  };

  if (user) {
    const token = randomBytes(32).toString('hex');
    user.passwordResetTokenHash = createHash('sha256').update(token).digest('hex');
    user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    if (isMailConfigured()) {
      const baseUrl = ENV.CLIENT_URL.split(',')[0].trim().replace(/\/$/, '');
      const resetUrl = `${baseUrl}/?resetToken=${encodeURIComponent(token)}`;
      try {
        await sendPasswordResetEmail(user.email, resetUrl);
      } catch (err) {
        console.error('[Auth] Password reset email could not be sent', err);
        if (ENV.NODE_ENV === 'production') {
          res.status(503).json({ code: 'email_delivery_failed', message: 'Password reset email is temporarily unavailable.' });
          return;
        }
        response.resetToken = token;
      }
    } else if (ENV.NODE_ENV !== 'production') {
      // Local-only convenience for development without SMTP; never returned in production.
      response.resetToken = token;
    }
  }

  res.json(response);
}

export async function confirmPasswordReset(req: Request, res: Response): Promise<void> {
  const data = PasswordResetConfirmSchema.parse(req.body);
  const tokenHash = createHash('sha256').update(data.token).digest('hex');
  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpiresAt');

  if (!user) {
    res.status(400).json({ code: 'invalid_reset_token', message: 'This reset link is invalid or has expired. Request a new one.' });
    return;
  }

  user.passwordHash = await bcrypt.hash(data.password, await bcrypt.genSalt(10));
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  await user.save();

  res.json({ message: 'Password updated. Sign in with your new password.' });
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
