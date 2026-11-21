import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import mongoose from 'mongoose';
import { verifyToken } from '../utils/jwt';
import { Membership } from '../models/Membership';
import { Tenant } from '../models/Tenant';
import { TenantEvent } from '../models/TenantEvent';
import { AuthUser, PresenceUser } from '../types';
import {
  createCorsOrigin,
  CORS_ALLOWED_HEADERS,
  CORS_EXPOSED_HEADERS,
  CORS_METHODS,
} from './cors';

let io: SocketIOServer | null = null;

// Map of socketId -> PresenceUser
const activeSockets = new Map<string, PresenceUser>();

export function initSocketIO(server: HttpServer, clientUrl: string): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: createCorsOrigin(clientUrl),
      methods: CORS_METHODS,
      allowedHeaders: CORS_ALLOWED_HEADERS,
      exposedHeaders: CORS_EXPOSED_HEADERS,
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // Socket authentication middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string) ||
        (socket.handshake.query?.token as string) ||
        (socket.handshake.headers['authorization']?.replace('Bearer ', ''));

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = verifyToken(token);
      (socket as any).user = decoded;
      next();
    } catch (err) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user as AuthUser;

    // Client requests to join a tenant room
    socket.on('join', async (payload: { tenantId: string; boardId?: string; lastSeq?: number }) => {
      try {
        const { tenantId, boardId, lastSeq } = payload;
        if (!tenantId || !mongoose.isValidObjectId(tenantId)) {
          socket.emit('error', { code: 'invalid_tenant', message: 'Valid tenantId is required' });
          return;
        }

        // Verify user membership in tenant or org
        const tenant = await Tenant.findById(tenantId).lean();
        if (!tenant) {
          socket.emit('error', { code: 'not_found', message: 'Tenant not found' });
          return;
        }

        const membership = await Membership.findOne({
          userId: user.id,
          organizationId: tenant.organizationId,
          $or: [
            { tenantId: new mongoose.Types.ObjectId(tenantId) },
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
        const presence: PresenceUser = {
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
          const missedEvents = await TenantEvent.find({
            tenantId: new mongoose.Types.ObjectId(tenantId),
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
      } catch (err: any) {
        socket.emit('error', { code: 'server_error', message: err.message });
      }
    });

    // Leave tenant room
    socket.on('leave', (payload: { tenantId: string }) => {
      const { tenantId } = payload;
      if (tenantId) {
        socket.leave(`tenant:${tenantId}`);
        activeSockets.delete(socket.id);
        broadcastTenantPresence(tenantId);
      }
    });

    // Presence heartbeat
    socket.on('presence.heartbeat', async (payload: { tenantId: string; boardId?: string; activeTaskId?: string }) => {
      const presence = activeSockets.get(socket.id);
      if (presence && payload.tenantId === presence.tenantId) {
        // Membership removal or role changes take effect on the next heartbeat.
        const tenantRecord = await Tenant.findById(presence.tenantId).select('organizationId').lean();
        const stillMember = tenantRecord && await Membership.exists({
          userId: user.id,
          organizationId: tenantRecord.organizationId,
          $or: [
            { tenantId: new mongoose.Types.ObjectId(presence.tenantId) },
            { tenantId: null, role: 'ORG_ADMIN' },
          ],
        });
        if (!stillMember) {
          socket.leave(`tenant:${presence.tenantId}`);
          activeSockets.delete(socket.id);
          broadcastTenantPresence(presence.tenantId);
          return;
        }
        presence.lastActive = Date.now();
        if (payload.boardId) presence.boardId = payload.boardId;
        presence.activeTaskId = payload.activeTaskId;
        broadcastTenantPresence(presence.tenantId);
      }
    });

    // Card focus indicator
    socket.on('cursor.focus', (payload: { tenantId: string; taskId: string | null }) => {
      const presence = activeSockets.get(socket.id);
      if (presence && payload.tenantId === presence.tenantId) {
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

export function getSocketIO(): SocketIOServer | null {
  return io;
}

function getActiveTenantUsers(tenantId: string): PresenceUser[] {
  const usersMap = new Map<string, PresenceUser>();
  for (const p of activeSockets.values()) {
    if (p.tenantId === tenantId) {
      usersMap.set(p.userId, p);
    }
  }
  return Array.from(usersMap.values());
}

function broadcastTenantPresence(tenantId: string) {
  if (!io) return;
  const activeUsers = getActiveTenantUsers(tenantId);
  io.to(`tenant:${tenantId}`).emit('presence.snapshot', {
    tenantId,
    users: activeUsers,
  });
}
