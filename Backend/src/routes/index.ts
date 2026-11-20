import { Router } from 'express';
import authRoutes from './authRoutes';
import orgRoutes from './orgRoutes';
import tenantRoutes from './tenantRoutes';

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'kanban-backend',
  });
});

router.use('/auth', authRoutes);
router.use('/orgs', orgRoutes);
router.use('/tenants', tenantRoutes);

export default router;
