import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import {
  scheduleCampaign,
  extractAndValidateEmails,
} from '../services/scheduler.service.js';
import { prisma } from '../config/prisma.js';

export const createCampaignSchema = z.object({
  senderId: z.string().uuid(),
  name: z.string().optional(),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Email body is required'),
  recipients: z.array(z.string()).min(1, 'At least one recipient is required'),
  startTime: z.string().datetime().optional(),
  delaySeconds: z.number().int().min(1).optional().default(2),
  hourlyLimit: z.number().int().min(1).optional().default(200),
});

export const handleCreateCampaign = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      senderId,
      name,
      subject,
      body,
      recipients,
      startTime,
      delaySeconds,
      hourlyLimit,
    } = req.body;

    const result = await scheduleCampaign({
      userId: req.user!.userId,
      senderId,
      name,
      subject,
      body,
      recipients,
      startTime: startTime ? new Date(startTime) : undefined,
      delaySeconds,
      hourlyLimit,
    });

    res.status(201).json({
      success: true,
      campaign: result.campaign,
      scheduledCount: result.scheduledCount,
    });
  } catch (error) {
    next(error);
  }
};

export const handleParseLeads = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let content = '';

    if (req.file) {
      content = req.file.buffer.toString('utf-8');
    } else if (req.body?.text) {
      content = req.body.text;
    } else {
      res.status(400).json({ error: 'No lead file or text content provided' });
      return;
    }

    const { validEmails, duplicatesRemoved, invalidCount } =
      extractAndValidateEmails(content);

    res.json({
      validEmails,
      validCount: validEmails.length,
      duplicatesRemoved,
      invalidCount,
    });
  } catch (error) {
    next(error);
  }
};

export const handleListCampaigns = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { userId: req.user!.userId },
      include: {
        senderRef: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ campaigns });
  } catch (error) {
    next(error);
  }
};
