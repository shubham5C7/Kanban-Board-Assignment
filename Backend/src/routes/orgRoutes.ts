import { Router } from 'express';
import {
  getOrganizations,
  createOrganization,
  getOrganization,
  updateOrganization,
  deleteOrganization,
} from '../controllers/orgController';
import { getTenantsInOrg, createTenant } from '../controllers/tenantController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getOrganizations);
router.post('/', createOrganization);
router.get('/:orgId', getOrganization);
router.patch('/:orgId', updateOrganization);
router.delete('/:orgId', deleteOrganization);

// Tenants nested under Org
router.get('/:orgId/tenants', getTenantsInOrg);
router.post('/:orgId/tenants', createTenant);

export default router;
