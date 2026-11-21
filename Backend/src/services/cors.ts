const LOCAL_ORIGIN = 'http://localhost:5173';
const VERCEL_PREVIEW_ORIGIN = /^https:\/\/kanban-board-assignment-[a-z0-9-]+\.vercel\.app$/;

export const CORS_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
export const CORS_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'If-Match',
  'If-None-Match',
  'ETag',
];
export const CORS_EXPOSED_HEADERS = ['ETag'];

export function createCorsOrigin(clientUrl: string | undefined) {
  const allowedOrigins = new Set([
    ...(clientUrl || '').split(',').map(value => value.trim().replace(/\/+$/, '')).filter(Boolean),
    LOCAL_ORIGIN,
  ]);

  return (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void): void => {
    if (!origin || allowedOrigins.has(origin) || VERCEL_PREVIEW_ORIGIN.test(origin)) {
      callback(null, true);
      return;
    }

    console.warn(`[CORS] Rejected origin: ${origin}`);
    callback(null, false);
  };
}
