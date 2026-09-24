import { Router } from 'express';
import {
  handleGetSenders,
  handleCreateSender,
  createSenderSchema,
} from '../controllers/sender.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', handleGetSenders);
router.post('/', validateBody(createSenderSchema), handleCreateSender);

export default router;
