import { io, Socket } from 'socket.io-client';
import { PresenceUser } from '../types';

let socket: Socket | null = null;
let heartbeatInterval: any = null;

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface SocketCallbacks {
  onStatusChange?: (status: ConnectionStatus) => void;
  onPresenceUpdate?: (users: PresenceUser[]) => void;
  onTaskEvent?: (event: { type: string; data: any; actorId: string }) => void;
  onColumnEvent?: (event: { type: string; data: any; actorId: string }) => void;
  onBoardEvent?: (event: { type: string; data: any; actorId: string }) => void;
  onReplayEvents?: (events: any[]) => void;
}

export function connectSocket(token: string, callbacks: SocketCallbacks = {}): Socket {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  socket = io('http://localhost:5000', {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
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
      callbacks.onTaskEvent?.({ type: evt, data: payload.data, actorId: payload.actorId });
    });
  });

  // Column events
  ['column.created', 'column.updated', 'column.moved', 'column.deleted'].forEach(evt => {
    socket?.on(evt, payload => {
      callbacks.onColumnEvent?.({ type: evt, data: payload.data, actorId: payload.actorId });
    });
  });

  // Board events
  ['board.created', 'board.updated', 'board.deleted'].forEach(evt => {
    socket?.on(evt, payload => {
      callbacks.onBoardEvent?.({ type: evt, data: payload.data, actorId: payload.actorId });
    });
  });

  socket.on('replay.events', (data: { events: any[] }) => {
    callbacks.onReplayEvents?.(data.events);
  });

  return socket;
}

export function joinTenantRoom(tenantId: string, boardId?: string, lastSeq?: number) {
  if (!socket) return;
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
