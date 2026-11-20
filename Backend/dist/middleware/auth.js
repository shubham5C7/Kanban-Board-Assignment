"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
const jwt_1 = require("../utils/jwt");
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ code: 'unauthorized', message: 'Bearer token required' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const user = (0, jwt_1.verifyToken)(token);
        req.user = user;
        next();
    }
    catch (err) {
        res.status(401).json({ code: 'invalid_token', message: 'Invalid or expired token' });
    }
}
