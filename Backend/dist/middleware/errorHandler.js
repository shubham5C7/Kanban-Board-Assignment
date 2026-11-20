"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
function errorHandler(err, req, res, next) {
    console.error('[Error Handler]', err);
    if (err instanceof zod_1.ZodError) {
        res.status(400).json({
            code: 'validation_error',
            message: 'Invalid request input',
            details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
        });
        return;
    }
    if (err.name === 'CastError' || err.name === 'BSONError' || err.message?.includes('must be a 24 character hex string')) {
        res.status(400).json({
            code: 'invalid_id',
            message: 'Invalid resource ID provided',
        });
        return;
    }
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        code: err.code || 'internal_server_error',
        message: err.message || 'An unexpected error occurred',
        details: err.details,
    });
}
