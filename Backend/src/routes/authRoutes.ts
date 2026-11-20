import { Router } from 'express';
import { register, login, getMe, requestPasswordReset, confirmPasswordReset } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { authRateLimit } from '../middleware/authRateLimit';

const router = Router();

router.post('/register', authRateLimit(5, 15 * 60 * 1000), register);
router.post('/login', authRateLimit(10, 15 * 60 * 1000), login);
router.post('/password-reset/request', authRateLimit(3, 15 * 60 * 1000), requestPasswordReset);
router.post('/password-reset/confirm', authRateLimit(10, 15 * 60 * 1000), confirmPasswordReset);
router.get('/me', authenticate, getMe);

export default router;
