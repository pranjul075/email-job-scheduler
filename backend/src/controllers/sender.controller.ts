import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';

export const createSenderSchema = z.object({
  name: z.string().min(1, 'Sender name is required'),
  email: z.string().email('Valid sender email is required'),
  host: z.string().optional().default('smtp.ethereal.email'),
  port: z.number().int().optional().default(587),
  user: z.string().optional(),
  pass: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
});

export const handleGetSenders = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const senders = await prisma.sender.findMany({
      where: { userId: req.user!.userId },
      select: {
        id: true,
        name: true,
        email: true,
        host: true,
        port: true,
        isDefault: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ senders });
  } catch (error) {
    next(error);
  }
};

export const handleCreateSender = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, host, port, user, pass, isDefault } = req.body;

    if (isDefault) {
      await prisma.sender.updateMany({
        where: { userId: req.user!.userId },
        data: { isDefault: false },
      });
    }

    const sender = await prisma.sender.create({
      data: {
        userId: req.user!.userId,
        name,
        email: email.toLowerCase(),
        host: host || env.ETHEREAL_HOST,
        port: port || env.ETHEREAL_PORT,
        user: user || env.ETHEREAL_USER || null,
        pass: pass || env.ETHEREAL_PASSWORD || null,
        isDefault: isDefault ?? false,
      },
    });

    res.status(201).json({ sender });
  } catch (error) {
    next(error);
  }
};
