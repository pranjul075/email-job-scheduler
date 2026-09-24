import { Router } from 'express';
import {
  handleGetScheduledEmails,
  handleGetSentEmails,
  handleGetEmailById,
  handleSearchEmails,
  handleGetEmailCounts,
} from '../controllers/email.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/scheduled', handleGetScheduledEmails);
router.get('/sent', handleGetSentEmails);
router.get('/search', handleSearchEmails);
router.get('/counts', handleGetEmailCounts);
router.get('/:id', handleGetEmailById);

export default router;
