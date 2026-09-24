import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import {
  getSlackAuthorizeUrl,
  handleSlackOAuthCallback,
  getSlackStatusForUser,
  disconnectSlackForUser,
  testSlackWebhookForUser,
} from '../services/slack.service.js';
import { env } from '../config/env.js';

export const handleGetSlackConnectUrl = (
  req: AuthenticatedRequest,
  res: Response
): void => {
  const url = getSlackAuthorizeUrl(req.user!.userId);
  res.json({ url });
};

export const handleSlackCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;

    if (!code || !state) {
      res.redirect(`${env.FRONTEND_URL}/dashboard?slack_error=missing_code_or_state`);
      return;
    }

    await handleSlackOAuthCallback(code, state);
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack_connected=true`);
  } catch (error: any) {
    res.redirect(
      `${env.FRONTEND_URL}/dashboard?slack_error=${encodeURIComponent(
        error.message || 'slack_auth_failed'
      )}`
    );
  }
};

export const handleGetSlackStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const status = await getSlackStatusForUser(req.user!.userId);
    res.json(status);
  } catch (error) {
    next(error);
  }
};

export const handleDisconnectSlack = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await disconnectSlackForUser(req.user!.userId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const handleTestSlackWebhook = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await testSlackWebhookForUser(req.user!.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
