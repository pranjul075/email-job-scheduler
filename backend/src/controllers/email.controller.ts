import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../config/prisma.js';
import { searchService } from '../services/elasticsearch.service.js';
import type { EmailStatus } from '@prisma/client';

export const handleGetScheduledEmails = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const where = {
      userId: req.user!.userId,
      status: { in: ['PENDING', 'PROCESSING', 'RATE_LIMITED'] as EmailStatus[] },
    };

    const [total, items] = await Promise.all([
      prisma.scheduledEmail.count({ where }),
      prisma.scheduledEmail.findMany({
        where,
        include: {
          senderRef: {
            select: { id: true, name: true, email: true },
          },
          campaignRef: {
            select: { id: true, name: true },
          },
        },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetSentEmails = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const where = {
      userId: req.user!.userId,
      status: { in: ['SENT', 'FAILED'] as EmailStatus[] },
    };

    const [total, items] = await Promise.all([
      prisma.scheduledEmail.count({ where }),
      prisma.scheduledEmail.findMany({
        where,
        include: {
          senderRef: {
            select: { id: true, name: true, email: true },
          },
          campaignRef: {
            select: { id: true, name: true },
          },
        },
        orderBy: { sentAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetEmailById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;

    const email = await prisma.scheduledEmail.findFirst({
      where: {
        id,
        userId: req.user!.userId,
      },
      include: {
        senderRef: true,
        campaignRef: true,
      },
    });

    if (!email) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    res.json({ email });
  } catch (error) {
    next(error);
  }
};

export const handleSearchEmails = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = (req.query.q as string) || '';
    const status = req.query.status as EmailStatus | undefined;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;

    const result = await searchService.searchUserEmails({
      userId: req.user!.userId,
      query,
      status,
      page,
      limit,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const handleGetEmailCounts = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const [scheduledCount, sentCount] = await Promise.all([
      prisma.scheduledEmail.count({
        where: {
          userId: req.user!.userId,
          status: { in: ['PENDING', 'PROCESSING', 'RATE_LIMITED'] },
        },
      }),
      prisma.scheduledEmail.count({
        where: {
          userId: req.user!.userId,
          status: 'SENT',
        },
      }),
    ]);

    res.json({
      scheduledCount,
      sentCount,
    });
  } catch (error) {
    next(error);
  }
};
