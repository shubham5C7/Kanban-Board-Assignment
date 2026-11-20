"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.verifyToken = verifyToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
function signToken(user) {
    const options = {
        expiresIn: env_1.ENV.JWT_EXPIRES_IN || '7d',
    };
    return jsonwebtoken_1.default.sign({ id: user.id, email: user.email, name: user.name }, env_1.ENV.JWT_SECRET, options);
}
function verifyToken(token) {
    return jsonwebtoken_1.default.verify(token, env_1.ENV.JWT_SECRET);
}
