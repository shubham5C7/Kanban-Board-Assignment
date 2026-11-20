import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';

export function requireOrgAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.membership?.role !== 'ORG_ADMIN') {
    res.status(403).json({
      code: 'forbidden',
      message: 'Organization administrator privileges required',
    });
    return;
  }
  next();
}

export function requireTenantAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.membership?.role !== 'ORG_ADMIN' && req.membership?.role !== 'TENANT_ADMIN') {
    res.status(403).json({
      code: 'forbidden',
      message: 'Tenant administrator privileges required',
    });
    return;
  }
  next();
}

export function requireMember(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.membership) {
    res.status(403).json({
      code: 'forbidden',
      message: 'Active membership required',
    });
    return;
  }
  next();
}
