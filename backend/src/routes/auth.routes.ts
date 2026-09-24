import { Router } from 'express';
import {
  handleGoogleRedirect,
  handleGoogleOAuthCallback,
  handleEmailRegister,
  handleEmailLogin,
  getCurrentUser,
  handleLogout,
  registerSchema,
  loginSchema,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';

const router = Router();

router.get('/google', handleGoogleRedirect);
router.get('/google/callback', handleGoogleOAuthCallback);
router.post('/register', validateBody(registerSchema), handleEmailRegister);
router.post('/login', validateBody(loginSchema), handleEmailLogin);
router.get('/me', requireAuth, getCurrentUser);
router.post('/logout', handleLogout);

export default router;
