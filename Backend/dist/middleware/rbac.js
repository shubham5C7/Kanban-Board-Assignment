"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireOrgAdmin = requireOrgAdmin;
exports.requireTenantAdmin = requireTenantAdmin;
exports.requireMember = requireMember;
function requireOrgAdmin(req, res, next) {
    if (req.membership?.role !== 'ORG_ADMIN') {
        res.status(403).json({
            code: 'forbidden',
            message: 'Organization administrator privileges required',
        });
        return;
    }
    next();
}
function requireTenantAdmin(req, res, next) {
    if (req.membership?.role !== 'ORG_ADMIN' && req.membership?.role !== 'TENANT_ADMIN') {
        res.status(403).json({
            code: 'forbidden',
            message: 'Tenant administrator privileges required',
        });
        return;
    }
    next();
}
function requireMember(req, res, next) {
    if (!req.membership) {
        res.status(403).json({
            code: 'forbidden',
            message: 'Active membership required',
        });
        return;
    }
    next();
}
