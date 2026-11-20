"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authRoutes_1 = __importDefault(require("./authRoutes"));
const orgRoutes_1 = __importDefault(require("./orgRoutes"));
const tenantRoutes_1 = __importDefault(require("./tenantRoutes"));
const router = (0, express_1.Router)();
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'kanban-backend',
    });
});
router.use('/auth', authRoutes_1.default);
router.use('/orgs', orgRoutes_1.default);
router.use('/tenants', tenantRoutes_1.default);
exports.default = router;
