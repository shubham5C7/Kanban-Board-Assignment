"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const orgController_1 = require("../controllers/orgController");
const tenantController_1 = require("../controllers/tenantController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/', orgController_1.getOrganizations);
router.post('/', orgController_1.createOrganization);
router.get('/:orgId', orgController_1.getOrganization);
router.patch('/:orgId', orgController_1.updateOrganization);
router.delete('/:orgId', orgController_1.deleteOrganization);
// Tenants nested under Org
router.get('/:orgId/tenants', tenantController_1.getTenantsInOrg);
router.post('/:orgId/tenants', tenantController_1.createTenant);
exports.default = router;
