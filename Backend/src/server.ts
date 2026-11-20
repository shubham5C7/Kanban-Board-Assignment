import http from 'http';
import { createApp } from './app';
import { connectDB } from './config/db';
import { ENV } from './config/env';
import { initSocketIO } from './services/realtime';

async function startServer() {
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);

  initSocketIO(server, ENV.CLIENT_URL);

  server.listen(ENV.PORT, () => {
    console.log(`[Server] Collaborative Kanban Backend running on http://localhost:${ENV.PORT}`);
    console.log(`[Server] Environment: ${ENV.NODE_ENV}`);
    console.log(`[Server] Client Origin: ${ENV.CLIENT_URL}`);
  });
}

startServer().catch(err => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
