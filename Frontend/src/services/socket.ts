import { io, Socket } from 'socket.io-client';
import { PresenceUser } from '../types';

let socket: Socket | null = null;
let heartbeatInterval: any = null;
let activeTenant: { tenantId: string; boardId?: string; lastSeq?: number } | null = null;

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface SocketCallbacks {
  onStatusChange?: (status: ConnectionStatus) => void;
  onPresenceUpdate?: (users: PresenceUser[]) => void;
  onTaskEvent?: (event: { type: string; data: any; actorId: string; seq?: number }) => void;
  onColumnEvent?: (event: { type: string; data: any; actorId: string; seq?: number }) => void;
  onBoardEvent?: (event: { type: string; data: any; actorId: string; seq?: number }) => void;
  onReplayEvents?: (events: any[]) => void;
}

export function connectSocket(token: string, callbacks: SocketCallbacks = {}): Socket {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  const socketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000';
  socket = io(socketUrl, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    if (activeTenant) socket?.emit('join', activeTenant);
    callbacks.onStatusChange?.('connected');
  });

  socket.on('disconnect', () => {
    callbacks.onStatusChange?.('disconnected');
  });

  socket.on('connect_error', () => {
    callbacks.onStatusChange?.('reconnecting');
  });

  socket.on('reconnect', () => {
    callbacks.onStatusChange?.('connected');
  });

  socket.on('presence.snapshot', (data: { users: PresenceUser[] }) => {
    callbacks.onPresenceUpdate?.(data.users);
  });

  // Task events
  ['task.created', 'task.updated', 'task.moved', 'task.deleted'].forEach(evt => {
    socket?.on(evt, payload => {
      callbacks.onTaskEvent?.({ type: evt, data: payload.data, actorId: payload.actorId, seq: payload.seq });
    });
  });

  // Column events
  ['column.created', 'column.updated', 'column.moved', 'column.deleted'].forEach(evt => {
    socket?.on(evt, payload => {
      callbacks.onColumnEvent?.({ type: evt, data: payload.data, actorId: payload.actorId, seq: payload.seq });
    });
  });

  // Board events
  ['board.created', 'board.updated', 'board.deleted'].forEach(evt => {
    socket?.on(evt, payload => {
      callbacks.onBoardEvent?.({ type: evt, data: payload.data, actorId: payload.actorId, seq: payload.seq });
    });
  });

  socket.on('replay.events', (data: { events: any[] }) => {
    callbacks.onReplayEvents?.(data.events);
  });

  return socket;
}

export function joinTenantRoom(tenantId: string, boardId?: string, lastSeq?: number) {
  if (!socket) return;
  activeTenant = { tenantId, boardId, lastSeq };
  socket.emit('join', { tenantId, boardId, lastSeq });

  // Clear previous heartbeat if any
  if (heartbeatInterval) clearInterval(heartbeatInterval);

  heartbeatInterval = setInterval(() => {
    if (socket?.connected) {
      socket.emit('presence.heartbeat', { tenantId, boardId });
    }
  }, 15000);
}

export function leaveTenantRoom(tenantId: string) {
  if (!socket) return;
  socket.emit('leave', { tenantId });
  if (activeTenant?.tenantId === tenantId) activeTenant = null;
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

export function sendCardFocus(tenantId: string, taskId: string | null) {
  if (!socket?.connected) return;
  socket.emit('cursor.focus', { tenantId, taskId });
}

export function disconnectSocket() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
