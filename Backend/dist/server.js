"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const app_1 = require("./app");
const db_1 = require("./config/db");
const env_1 = require("./config/env");
const realtime_1 = require("./services/realtime");
async function startServer() {
    await (0, db_1.connectDB)();
    const app = (0, app_1.createApp)();
    const server = http_1.default.createServer(app);
    (0, realtime_1.initSocketIO)(server, env_1.ENV.CLIENT_URL);
    server.listen(env_1.ENV.PORT, () => {
        console.log(`[Server] Collaborative Kanban Backend running on http://localhost:${env_1.ENV.PORT}`);
        console.log(`[Server] Environment: ${env_1.ENV.NODE_ENV}`);
        console.log(`[Server] Client Origin: ${env_1.ENV.CLIENT_URL}`);
    });
}
startServer().catch(err => {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
});
