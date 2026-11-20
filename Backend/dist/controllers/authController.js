"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.getMe = getMe;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const User_1 = require("../models/User");
const Membership_1 = require("../models/Membership");
const jwt_1 = require("../utils/jwt");
const RegisterSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email(),
    name: zod_1.z.string().min(2),
    password: zod_1.z.string().min(6),
    avatarUrl: zod_1.z.string().optional(),
});
const LoginSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email(),
    password: zod_1.z.string(),
});
async function register(req, res) {
    const data = RegisterSchema.parse(req.body);
    const existingUser = await User_1.User.findOne({ email: data.email.toLowerCase() });
    if (existingUser) {
        res.status(409).json({ code: 'user_exists', message: 'User with this email already exists' });
        return;
    }
    const salt = await bcryptjs_1.default.genSalt(10);
    const passwordHash = await bcryptjs_1.default.hash(data.password, salt);
    const user = await User_1.User.create({
        email: data.email.toLowerCase(),
        name: data.name,
        passwordHash,
        avatarUrl: data.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(data.name)}`,
    });
    const token = (0, jwt_1.signToken)({ id: user._id.toString(), email: user.email, name: user.name });
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
async function login(req, res) {
    const data = LoginSchema.parse(req.body);
    const user = await User_1.User.findOne({ email: data.email.toLowerCase() });
    if (!user) {
        res.status(401).json({ code: 'invalid_credentials', message: 'Invalid email or password' });
        return;
    }
    const isMatch = await user.comparePassword(data.password);
    if (!isMatch) {
        res.status(401).json({ code: 'invalid_credentials', message: 'Invalid email or password' });
        return;
    }
    const token = (0, jwt_1.signToken)({ id: user._id.toString(), email: user.email, name: user.name });
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
async function getMe(req, res) {
    if (!req.user) {
        res.status(401).json({ code: 'unauthorized', message: 'Authentication required' });
        return;
    }
    const user = await User_1.User.findById(req.user.id).select('-passwordHash');
    if (!user) {
        res.status(404).json({ code: 'user_not_found', message: 'User not found' });
        return;
    }
    // Find all memberships
    const memberships = await Membership_1.Membership.find({ userId: user._id })
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
