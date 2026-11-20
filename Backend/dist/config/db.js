"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("./env");
async function connectDB() {
    try {
        const conn = await mongoose_1.default.connect(env_1.ENV.MONGODB_URI);
        console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
        return conn;
    }
    catch (error) {
        console.error('[Database] Connection Error:', error);
        process.exit(1);
    }
}
