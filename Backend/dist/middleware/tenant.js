"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTenant = resolveTenant;
const mongoose_1 = __importDefault(require("mongoose"));
const Tenant_1 = require("../models/Tenant");
const Membership_1 = require("../models/Membership");
async function resolveTenant(req, res, next) {
    const tenantId = req.params.tenantId || req.headers['x-tenant-id'];
    if (!tenantId || !mongoose_1.default.isValidObjectId(tenantId)) {
        // 404 so existence is never leaked
        res.status(404).json({ code: 'tenant_not_found', message: 'Tenant not found' });
        return;
    }
    try {
        const tenant = await Tenant_1.Tenant.findById(tenantId);
        if (!tenant) {
            res.status(404).json({ code: 'tenant_not_found', message: 'Tenant not found' });
            return;
        }
        if (!req.user) {
            res.status(401).json({ code: 'unauthorized', message: 'User authentication required' });
            return;
        }
        // Verify user is member of this tenant OR an Org Admin of the organization
        const membership = await Membership_1.Membership.findOne({
            userId: req.user.id,
            organizationId: tenant.organizationId,
            $or: [
                { tenantId: new mongoose_1.default.Types.ObjectId(tenantId) },
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
    }
    catch (err) {
        res.status(500).json({ code: 'server_error', message: err.message });
    }
}
