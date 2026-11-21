const API_BASE = `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')}/api/v1`;

export class ApiError extends Error {
  code: string;
  statusCode: number;
  details?: any;
  currentRecord?: any;

  constructor(code: string, message: string, statusCode: number, details?: any, currentRecord?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.currentRecord = currentRecord;
  }
}

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('kanban_token') || sessionStorage.getItem('kanban_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      data.code || 'unknown_error',
      data.message || 'An error occurred',
      response.status,
      data.details,
      data.currentRecord
    );
  }

  return data as T;
}

export const api = {
  // Auth
  login: (credentials: { email: string; password: string; rememberMe?: boolean }) =>
    request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  register: (payload: { name: string; email: string; password: string }) =>
    request<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  requestPasswordReset: (email: string) =>
    request<{ message: string; resetToken?: string }>('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (payload: { token: string; password: string }) =>
    request<{ message: string }>('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMe: () => request<{ user: any; memberships: any[] }>('/auth/me'),

  // Organizations
  getOrganizations: () => request<{ organizations: any[] }>('/orgs'),
  createOrganization: (payload: { name: string; slug: string }) =>
    request<{ organization: any }>('/orgs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Tenants
  getTenantsInOrg: (orgId: string) => request<{ tenants: any[] }>(`/orgs/${orgId}/tenants`),
  createTenant: (orgId: string, payload: { name: string; slug: string }) =>
    request<{ tenant: any }>(`/orgs/${orgId}/tenants`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Tenant details & members
  getTenant: (tenantId: string) => request<{ tenant: any; role: string }>(`/tenants/${tenantId}`),
  getMembers: (tenantId: string) => request<{ members: any[] }>(`/tenants/${tenantId}/members`),
  addMember: (tenantId: string, payload: { email: string; role: string }) =>
    request<{ membership: any }>(`/tenants/${tenantId}/members`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Boards
  getBoards: (tenantId: string) => request<{ boards: any[] }>(`/tenants/${tenantId}/boards`),
  getBoard: (tenantId: string, boardId: string) =>
    request<{ board: any; columns: any[]; tasks: any[] }>(`/tenants/${tenantId}/boards/${boardId}`),
  createBoard: (tenantId: string, payload: { name: string; description?: string }) =>
    request<{ board: any; columns: any[] }>(`/tenants/${tenantId}/boards`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteBoard: (tenantId: string, boardId: string) =>
    request<{ message: string }>(`/tenants/${tenantId}/boards/${boardId}`, {
      method: 'DELETE',
    }),

  // Columns
  createColumn: (tenantId: string, boardId: string, payload: { name: string; color?: string }) =>
    request<{ column: any }>(`/tenants/${tenantId}/boards/${boardId}/columns`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateColumn: (tenantId: string, columnId: string, payload: any) =>
    request<{ column: any }>(`/tenants/${tenantId}/columns/${columnId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteColumn: (tenantId: string, columnId: string) =>
    request<{ message: string }>(`/tenants/${tenantId}/columns/${columnId}`, {
      method: 'DELETE',
    }),
  moveColumn: (tenantId: string, columnId: string, payload: any) =>
    request<{ column: any }>(`/tenants/${tenantId}/columns/${columnId}/move`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Tasks
  createTask: (tenantId: string, columnId: string, payload: any) =>
    request<{ task: any }>(`/tenants/${tenantId}/columns/${columnId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getTask: (tenantId: string, taskId: string) =>
    request<{ task: any }>(`/tenants/${tenantId}/tasks/${taskId}`),
  updateTask: (tenantId: string, taskId: string, payload: any) =>
    request<{ task: any }>(`/tenants/${tenantId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  moveTask: (tenantId: string, taskId: string, payload: any) =>
    request<{ task: any; undoPayload: any }>(`/tenants/${tenantId}/tasks/${taskId}/move`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteTask: (tenantId: string, taskId: string) =>
    request<{ message: string }>(`/tenants/${tenantId}/tasks/${taskId}`, {
      method: 'DELETE',
    }),
  undoTask: (tenantId: string, taskId: string, payload: any) =>
    request<{ task: any; message: string }>(`/tenants/${tenantId}/tasks/${taskId}/undo`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Activity & Events
  getActivity: (tenantId: string, cursor?: string) =>
    request<{ logs: any[]; nextCursor?: string; hasMore: boolean }>(
      `/tenants/${tenantId}/activity${cursor ? `?cursor=${cursor}` : ''}`
    ),
  getMissedEvents: (tenantId: string, afterSeq: number) =>
    request<{ events: any[]; latestSeq: number }>(`/tenants/${tenantId}/events?after=${afterSeq}`),
};
