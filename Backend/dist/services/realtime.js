"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocketIO = initSocketIO;
exports.getSocketIO = getSocketIO;
const socket_io_1 = require("socket.io");
const mongoose_1 = __importDefault(require("mongoose"));
const jwt_1 = require("../utils/jwt");
const Membership_1 = require("../models/Membership");
const Tenant_1 = require("../models/Tenant");
const TenantEvent_1 = require("../models/TenantEvent");
let io = null;
// Map of socketId -> PresenceUser
const activeSockets = new Map();
function initSocketIO(server, clientUrl) {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: clientUrl || '*',
            methods: ['GET', 'POST', 'PATCH', 'DELETE'],
            credentials: true,
        },
        pingInterval: 10000,
        pingTimeout: 5000,
    });
    // Socket authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token ||
                socket.handshake.query?.token ||
                (socket.handshake.headers['authorization']?.replace('Bearer ', ''));
            if (!token) {
                return next(new Error('Authentication required'));
            }
            const decoded = (0, jwt_1.verifyToken)(token);
            socket.user = decoded;
            next();
        }
        catch (err) {
            return next(new Error('Invalid token'));
        }
    });
    io.on('connection', (socket) => {
        const user = socket.user;
        // Client requests to join a tenant room
        socket.on('join', async (payload) => {
            try {
                const { tenantId, boardId, lastSeq } = payload;
                if (!tenantId || !mongoose_1.default.isValidObjectId(tenantId)) {
                    socket.emit('error', { code: 'invalid_tenant', message: 'Valid tenantId is required' });
                    return;
                }
                // Verify user membership in tenant or org
                const tenant = await Tenant_1.Tenant.findById(tenantId).lean();
                if (!tenant) {
                    socket.emit('error', { code: 'not_found', message: 'Tenant not found' });
                    return;
                }
                const membership = await Membership_1.Membership.findOne({
                    userId: user.id,
                    organizationId: tenant.organizationId,
                    $or: [
                        { tenantId: new mongoose_1.default.Types.ObjectId(tenantId) },
                        { tenantId: null, role: 'ORG_ADMIN' },
                    ],
                }).lean();
                if (!membership) {
                    socket.emit('error', { code: 'forbidden', message: 'Access to tenant denied' });
                    return;
                }
                // Leave any prior rooms
                const currentRooms = Array.from(socket.rooms).filter(r => r !== socket.id);
                currentRooms.forEach(room => socket.leave(room));
                // Join tenant room
                const roomName = `tenant:${tenantId}`;
                socket.join(roomName);
                // Track presence
                const presence = {
                    userId: user.id,
                    name: user.name,
                    email: user.email,
                    tenantId,
                    boardId,
                    lastActive: Date.now(),
                };
                activeSockets.set(socket.id, presence);
                // Broadcast presence update
                broadcastTenantPresence(tenantId);
                // Replay missed events if client was disconnected
                if (typeof lastSeq === 'number' && lastSeq >= 0) {
                    const missedEvents = await TenantEvent_1.TenantEvent.find({
                        tenantId: new mongoose_1.default.Types.ObjectId(tenantId),
                        seq: { $gt: lastSeq },
                    })
                        .sort({ seq: 1 })
                        .limit(100)
                        .lean();
                    if (missedEvents.length > 0) {
                        socket.emit('replay.events', { events: missedEvents });
                    }
                }
                socket.emit('joined', {
                    tenantId,
                    room: roomName,
                    activeUsers: getActiveTenantUsers(tenantId),
                });
            }
            catch (err) {
                socket.emit('error', { code: 'server_error', message: err.message });
            }
        });
        // Leave tenant room
        socket.on('leave', (payload) => {
            const { tenantId } = payload;
            if (tenantId) {
                socket.leave(`tenant:${tenantId}`);
                activeSockets.delete(socket.id);
                broadcastTenantPresence(tenantId);
            }
        });
        // Presence heartbeat
        socket.on('presence.heartbeat', (payload) => {
            const presence = activeSockets.get(socket.id);
            if (presence) {
                presence.lastActive = Date.now();
                if (payload.boardId)
                    presence.boardId = payload.boardId;
                presence.activeTaskId = payload.activeTaskId;
                broadcastTenantPresence(presence.tenantId);
            }
        });
        // Card focus indicator
        socket.on('cursor.focus', (payload) => {
            const presence = activeSockets.get(socket.id);
            if (presence) {
                presence.activeTaskId = payload.taskId || undefined;
                presence.lastActive = Date.now();
                broadcastTenantPresence(presence.tenantId);
            }
        });
        socket.on('disconnect', () => {
            const presence = activeSockets.get(socket.id);
            if (presence) {
                const tenantId = presence.tenantId;
                activeSockets.delete(socket.id);
                broadcastTenantPresence(tenantId);
            }
        });
    });
    // Cleanup inactive sockets every 30 seconds
    setInterval(() => {
        const now = Date.now();
        for (const [sockId, p] of activeSockets.entries()) {
            if (now - p.lastActive > 45000) {
                const tId = p.tenantId;
                activeSockets.delete(sockId);
                broadcastTenantPresence(tId);
            }
        }
    }, 30000);
    return io;
}
function getSocketIO() {
    return io;
}
function getActiveTenantUsers(tenantId) {
    const usersMap = new Map();
    for (const p of activeSockets.values()) {
        if (p.tenantId === tenantId) {
            usersMap.set(p.userId, p);
        }
    }
    return Array.from(usersMap.values());
}
function broadcastTenantPresence(tenantId) {
    if (!io)
        return;
    const activeUsers = getActiveTenantUsers(tenantId);
    io.to(`tenant:${tenantId}`).emit('presence.snapshot', {
        tenantId,
        users: activeUsers,
    });
}
