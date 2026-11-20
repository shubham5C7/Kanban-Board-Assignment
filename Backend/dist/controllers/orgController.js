"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrganizations = getOrganizations;
exports.createOrganization = createOrganization;
exports.getOrganization = getOrganization;
exports.updateOrganization = updateOrganization;
exports.deleteOrganization = deleteOrganization;
const zod_1 = require("zod");
const mongoose_1 = __importDefault(require("mongoose"));
const Organization_1 = require("../models/Organization");
const Membership_1 = require("../models/Membership");
const Tenant_1 = require("../models/Tenant");
const CreateOrgSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    slug: zod_1.z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric with hyphens'),
});
const UpdateOrgSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
});
async function getOrganizations(req, res) {
    const userId = req.user.id;
    const memberships = await Membership_1.Membership.find({ userId: new mongoose_1.default.Types.ObjectId(userId) }).lean();
    const orgIds = Array.from(new Set(memberships.map(m => m.organizationId.toString())));
    const organizations = await Organization_1.Organization.find({ _id: { $in: orgIds } }).sort({ createdAt: -1 });
    res.json({ organizations });
}
async function createOrganization(req, res) {
    const data = CreateOrgSchema.parse(req.body);
    const userId = req.user.id;
    const existing = await Organization_1.Organization.findOne({ slug: data.slug.toLowerCase() });
    if (existing) {
        res.status(409).json({ code: 'org_slug_exists', message: 'Organization slug already taken' });
        return;
    }
    const org = await Organization_1.Organization.create({
        name: data.name,
        slug: data.slug.toLowerCase(),
    });
    // Assign user as ORG_ADMIN
    await Membership_1.Membership.create({
        userId: new mongoose_1.default.Types.ObjectId(userId),
        organizationId: org._id,
        tenantId: null,
        role: 'ORG_ADMIN',
    });
    res.status(201).json({ organization: org });
}
async function getOrganization(req, res) {
    const { orgId } = req.params;
    const userId = req.user.id;
    if (!mongoose_1.default.isValidObjectId(orgId)) {
        res.status(404).json({ code: 'org_not_found', message: 'Organization not found' });
        return;
    }
    const userObjectId = new mongoose_1.default.Types.ObjectId(userId);
    const orgObjectId = new mongoose_1.default.Types.ObjectId(orgId);
    const orgAdmin = await Membership_1.Membership.findOne({
        userId: userObjectId,
        organizationId: orgObjectId,
        tenantId: null,
        role: 'ORG_ADMIN',
    });
    const tenantMemberships = await Membership_1.Membership.find({
        userId: userObjectId,
        organizationId: orgObjectId,
        tenantId: { $ne: null },
    }).lean();
    if (!orgAdmin && tenantMemberships.length === 0) {
        res.status(404).json({ code: 'org_not_found', message: 'Organization not found' });
        return;
    }
    const org = await Organization_1.Organization.findById(orgId);
    if (!org) {
        res.status(404).json({ code: 'org_not_found', message: 'Organization not found' });
        return;
    }
    const tenantFilter = orgAdmin
        ? { organizationId: org._id }
        : { _id: { $in: tenantMemberships.map((membership) => membership.tenantId) } };
    const tenants = await Tenant_1.Tenant.find(tenantFilter).sort({ name: 1 });
    res.json({ organization: org, tenants });
}
async function updateOrganization(req, res) {
    const { orgId } = req.params;
    const userId = req.user.id;
    const data = UpdateOrgSchema.parse(req.body);
    const membership = await Membership_1.Membership.findOne({
        userId: new mongoose_1.default.Types.ObjectId(userId),
        organizationId: new mongoose_1.default.Types.ObjectId(orgId),
        role: 'ORG_ADMIN',
    });
    if (!membership) {
        res.status(403).json({ code: 'forbidden', message: 'Org Admin privileges required' });
        return;
    }
    const org = await Organization_1.Organization.findByIdAndUpdate(orgId, { $set: data }, { new: true });
    if (!org) {
        res.status(404).json({ code: 'org_not_found', message: 'Organization not found' });
        return;
    }
    res.json({ organization: org });
}
async function deleteOrganization(req, res) {
    const { orgId } = req.params;
    const userId = req.user.id;
    const membership = await Membership_1.Membership.findOne({
        userId: new mongoose_1.default.Types.ObjectId(userId),
        organizationId: new mongoose_1.default.Types.ObjectId(orgId),
        role: 'ORG_ADMIN',
    });
    if (!membership) {
        res.status(403).json({ code: 'forbidden', message: 'Org Admin privileges required' });
        return;
    }
    await Organization_1.Organization.findByIdAndDelete(orgId);
    await Tenant_1.Tenant.deleteMany({ organizationId: new mongoose_1.default.Types.ObjectId(orgId) });
    await Membership_1.Membership.deleteMany({ organizationId: new mongoose_1.default.Types.ObjectId(orgId) });
    res.json({ message: 'Organization deleted successfully' });
}
