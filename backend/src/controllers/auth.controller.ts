import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  getGoogleAuthUrl,
  handleGoogleAuthCallback,
  registerWithEmail,
  loginWithEmail,
  signUserToken,
} from '../services/auth.service.js';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const getCookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
});

export const handleGoogleRedirect = (req: Request, res: Response): void => {
  const url = getGoogleAuthUrl();
  res.redirect(url);
};

export const handleGoogleOAuthCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const code = req.query.code as string;
    if (!code) {
      res.redirect(`${env.FRONTEND_URL}/login?error=missing_code`);
      return;
    }

    const user = await handleGoogleAuthCallback(code);
    const token = signUserToken(user);

    res.cookie('auth_token', token, getCookieOptions());
    res.redirect(`${env.FRONTEND_URL}/dashboard`);
  } catch (error: any) {
    res.redirect(`${env.FRONTEND_URL}/login?error=${encodeURIComponent(error.message || 'auth_failed')}`);
  }
};

export const handleEmailRegister = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password, name } = req.body;
    const user = await registerWithEmail(email, password, name);
    const token = signUserToken(user);

    res.cookie('auth_token', token, getCookieOptions());
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const handleEmailLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;
    const user = await loginWithEmail(email, password);
    const token = signUserToken(user);

    res.cookie('auth_token', token, getCookieOptions());
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
        senders: {
          select: {
            id: true,
            name: true,
            email: true,
            isDefault: true,
          },
        },
        slackConnection: {
          select: {
            teamName: true,
            channelName: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        senders: user.senders,
        slackConnected: !!user.slackConnection,
        slackTeam: user.slackConnection?.teamName || null,
        slackChannel: user.slackConnection?.channelName || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const handleLogout = (req: Request, res: Response): void => {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  res.json({ success: true });
};
