import { Router } from 'express';
import multer from 'multer';
import {
  handleCreateCampaign,
  handleParseLeads,
  handleListCampaigns,
  createCampaignSchema,
} from '../controllers/campaign.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = Router();

router.use(requireAuth);

router.post('/', validateBody(createCampaignSchema), handleCreateCampaign);
router.get('/', handleListCampaigns);
router.post('/parse-leads', upload.single('file'), handleParseLeads);

export default router;
