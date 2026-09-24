import { Router } from 'express';
import {
  handleGetSlackConnectUrl,
  handleSlackCallback,
  handleGetSlackStatus,
  handleDisconnectSlack,
  handleTestSlackWebhook,
} from '../controllers/slack.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/callback', handleSlackCallback);

router.use(requireAuth);
router.get('/connect', handleGetSlackConnectUrl);
router.get('/status', handleGetSlackStatus);
router.post('/disconnect', handleDisconnectSlack);
router.post('/test', handleTestSlackWebhook);

export default router;
