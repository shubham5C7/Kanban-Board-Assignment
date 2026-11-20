import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../types';
import { Tenant } from '../models/Tenant';
import { Membership } from '../models/Membership';

export async function resolveTenant(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const tenantId = req.params.tenantId || (req.headers['x-tenant-id'] as string);

  if (!tenantId || !mongoose.isValidObjectId(tenantId)) {
    // 404 so existence is never leaked
    res.status(404).json({ code: 'tenant_not_found', message: 'Tenant not found' });
    return;
  }

  try {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      res.status(404).json({ code: 'tenant_not_found', message: 'Tenant not found' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ code: 'unauthorized', message: 'User authentication required' });
      return;
    }

    // Verify user is member of this tenant OR an Org Admin of the organization
    const membership = await Membership.findOne({
      userId: req.user.id,
      organizationId: tenant.organizationId,
      $or: [
        { tenantId: new mongoose.Types.ObjectId(tenantId) },
        { tenantId: null, role: 'ORG_ADMIN' },
      ],
    });

    if (!membership) {
      // Return 404 (not 403) to prevent ID guessing / tenant enumeration per PRD section 8
      res.status(404).json({ code: 'tenant_not_found', message: 'Tenant not found' });
      return;
    }

    req.tenantId = tenantId;
    req.membership = {
      id: membership._id.toString(),
      userId: membership.userId.toString(),
      organizationId: membership.organizationId.toString(),
      tenantId: membership.tenantId ? membership.tenantId.toString() : null,
      role: membership.role,
    };

    next();
  } catch (err: any) {
    res.status(500).json({ code: 'server_error', message: err.message });
  }
}
