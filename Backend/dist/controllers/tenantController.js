"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantsInOrg = getTenantsInOrg;
exports.createTenant = createTenant;
exports.getTenant = getTenant;
exports.updateTenant = updateTenant;
exports.deleteTenant = deleteTenant;
const zod_1 = require("zod");
const mongoose_1 = __importDefault(require("mongoose"));
const Tenant_1 = require("../models/Tenant");
const Membership_1 = require("../models/Membership");
const Board_1 = require("../models/Board");
const Column_1 = require("../models/Column");
const Task_1 = require("../models/Task");
const ActivityLog_1 = require("../models/ActivityLog");
const CreateTenantSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    slug: zod_1.z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric with hyphens'),
});
const UpdateTenantSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
});
async function getTenantsInOrg(req, res) {
    const { orgId } = req.params;
    const userId = req.user.id;
    if (!mongoose_1.default.isValidObjectId(orgId)) {
        res.status(404).json({ code: 'org_not_found', message: 'Organization not found' });
        return;
    }
    // Check if user has membership in org
    const orgMembership = await Membership_1.Membership.findOne({
        userId: new mongoose_1.default.Types.ObjectId(userId),
        organizationId: new mongoose_1.default.Types.ObjectId(orgId),
    });
    if (!orgMembership) {
        res.status(404).json({ code: 'org_not_found', message: 'Organization not found' });
        return;
    }
    // If org admin, can see all tenants in this org
    if (orgMembership.role === 'ORG_ADMIN') {
        const tenants = await Tenant_1.Tenant.find({ organizationId: new mongoose_1.default.Types.ObjectId(orgId) }).sort({ name: 1 });
        res.json({ tenants });
        return;
    }
    // Otherwise, only tenants where user has specific membership
    const memberships = await Membership_1.Membership.find({
        userId: new mongoose_1.default.Types.ObjectId(userId),
        organizationId: new mongoose_1.default.Types.ObjectId(orgId),
        tenantId: { $ne: null },
    }).lean();
    const tenantIds = memberships.map(m => m.tenantId);
    const tenants = await Tenant_1.Tenant.find({ _id: { $in: tenantIds } }).sort({ name: 1 });
    res.json({ tenants });
}
async function createTenant(req, res) {
    const { orgId } = req.params;
    const userId = req.user.id;
    const data = CreateTenantSchema.parse(req.body);
    // Require ORG_ADMIN for tenant creation
    const orgAdminMembership = await Membership_1.Membership.findOne({
        userId: new mongoose_1.default.Types.ObjectId(userId),
        organizationId: new mongoose_1.default.Types.ObjectId(orgId),
        role: 'ORG_ADMIN',
    });
    if (!orgAdminMembership) {
        res.status(403).json({ code: 'forbidden', message: 'Only Org Admin can create tenants' });
        return;
    }
    const existing = await Tenant_1.Tenant.findOne({
        organizationId: new mongoose_1.default.Types.ObjectId(orgId),
        slug: data.slug.toLowerCase(),
    });
    if (existing) {
        res.status(409).json({ code: 'tenant_slug_exists', message: 'Tenant slug already exists in this organization' });
        return;
    }
    const tenant = await Tenant_1.Tenant.create({
        organizationId: new mongoose_1.default.Types.ObjectId(orgId),
        name: data.name,
        slug: data.slug.toLowerCase(),
    });
    // Automatically grant tenant admin to creator
    await Membership_1.Membership.create({
        userId: new mongoose_1.default.Types.ObjectId(userId),
        organizationId: new mongoose_1.default.Types.ObjectId(orgId),
        tenantId: tenant._id,
        role: 'TENANT_ADMIN',
    });
    res.status(201).json({ tenant });
}
async function getTenant(req, res) {
    const tenant = await Tenant_1.Tenant.findById(req.tenantId).populate('organizationId', 'name slug');
    if (!tenant) {
        res.status(404).json({ code: 'tenant_not_found', message: 'Tenant not found' });
        return;
    }
    res.json({
        tenant,
        role: req.membership?.role,
    });
}
async function updateTenant(req, res) {
    const data = UpdateTenantSchema.parse(req.body);
    const tenant = await Tenant_1.Tenant.findByIdAndUpdate(req.tenantId, { $set: data }, { new: true });
    res.json({ tenant });
}
async function deleteTenant(req, res) {
    const tenantId = req.tenantId;
    const tenantObjectId = new mongoose_1.default.Types.ObjectId(tenantId);
    await Tenant_1.Tenant.findByIdAndDelete(tenantId);
    await Board_1.Board.deleteMany({ tenantId: tenantObjectId });
    await Column_1.Column.deleteMany({ tenantId: tenantObjectId });
    await Task_1.Task.deleteMany({ tenantId: tenantObjectId });
    await ActivityLog_1.ActivityLog.deleteMany({ tenantId: tenantObjectId });
    await Membership_1.Membership.deleteMany({ tenantId: tenantObjectId });
    res.json({ message: 'Tenant deleted successfully' });
}
