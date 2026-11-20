"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMembers = getMembers;
exports.addMember = addMember;
exports.updateMemberRole = updateMemberRole;
exports.removeMember = removeMember;
const zod_1 = require("zod");
const mongoose_1 = __importDefault(require("mongoose"));
const Membership_1 = require("../models/Membership");
const User_1 = require("../models/User");
const Tenant_1 = require("../models/Tenant");
const AddMemberSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email(),
    role: zod_1.z.enum(['TENANT_ADMIN', 'MEMBER']).default('MEMBER'),
});
const UpdateRoleSchema = zod_1.z.object({
    role: zod_1.z.enum(['TENANT_ADMIN', 'MEMBER']),
});
async function getMembers(req, res) {
    const tenantId = req.tenantId;
    const tenantObjectId = new mongoose_1.default.Types.ObjectId(tenantId);
    const memberships = await Membership_1.Membership.find({ tenantId: tenantObjectId })
        .populate('userId', 'name email avatarUrl')
        .sort({ createdAt: -1 })
        .lean();
    res.json({
        members: memberships.map((m) => ({
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
async function addMember(req, res) {
    const tenantId = req.tenantId;
    const data = AddMemberSchema.parse(req.body);
    const tenant = await Tenant_1.Tenant.findById(tenantId);
    if (!tenant) {
        res.status(404).json({ code: 'tenant_not_found', message: 'Tenant not found' });
        return;
    }
    // Find user by email
    let user = await User_1.User.findOne({ email: data.email.toLowerCase() });
    if (!user) {
        res.status(404).json({ code: 'user_not_found', message: 'User with this email not found' });
        return;
    }
    // Check if membership already exists in this tenant
    const existing = await Membership_1.Membership.findOne({
        userId: user._id,
        organizationId: tenant.organizationId,
        tenantId: tenant._id,
    });
    if (existing) {
        res.status(409).json({ code: 'member_already_exists', message: 'User is already a member of this tenant' });
        return;
    }
    const membership = await Membership_1.Membership.create({
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
async function updateMemberRole(req, res) {
    const tenantId = req.tenantId;
    const { memberId } = req.params;
    const data = UpdateRoleSchema.parse(req.body);
    const membership = await Membership_1.Membership.findOneAndUpdate({ _id: new mongoose_1.default.Types.ObjectId(memberId), tenantId: new mongoose_1.default.Types.ObjectId(tenantId) }, { $set: { role: data.role } }, { new: true }).populate('userId', 'name email avatarUrl');
    if (!membership) {
        res.status(404).json({ code: 'member_not_found', message: 'Membership not found' });
        return;
    }
    res.json({ membership });
}
async function removeMember(req, res) {
    const tenantId = req.tenantId;
    const { memberId } = req.params;
    const result = await Membership_1.Membership.findOneAndDelete({
        _id: new mongoose_1.default.Types.ObjectId(memberId),
        tenantId: new mongoose_1.default.Types.ObjectId(tenantId),
    });
    if (!result) {
        res.status(404).json({ code: 'member_not_found', message: 'Membership not found' });
        return;
    }
    res.json({ message: 'Member removed from tenant' });
}
