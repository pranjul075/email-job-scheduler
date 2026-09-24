import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';

export interface UserSessionPayload {
  userId: string;
  email: string;
}

export const signUserToken = (user: { id: string; email: string }): string => {
  return jwt.sign(
    { userId: user.id, email: user.email },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

export const verifyUserToken = (token: string): UserSessionPayload => {
  return jwt.verify(token, env.JWT_SECRET) as UserSessionPayload;
};

export const getGoogleAuthUrl = (): string => {
  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const options = {
    redirect_uri: env.GOOGLE_CALLBACK_URL,
    client_id: env.GOOGLE_CLIENT_ID,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
  };

  const qs = new URLSearchParams(options);
  return `${rootUrl}?${qs.toString()}`;
};

export const handleGoogleAuthCallback = async (code: string) => {
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_CALLBACK_URL,
      grant_type: 'authorization_code',
    }),
  });

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
    id_token?: string;
    error?: string;
  };

  if (!tokenData.access_token) {
    throw new Error(tokenData.error || 'Failed to exchange Google OAuth code');
  }

  const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  const profile = (await userinfoResponse.json()) as {
    sub: string;
    email: string;
    name: string;
    picture?: string;
  };

  if (!profile.email) {
    throw new Error('Google account has no associated email address');
  }

  let user = await prisma.user.findFirst({
    where: {
      OR: [{ googleId: profile.sub }, { email: profile.email.toLowerCase() }],
    },
  });

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId: profile.sub,
        name: profile.name || user.name,
        avatar: profile.picture || user.avatar,
      },
    });
  } else {
    user = await prisma.user.create({
      data: {
        googleId: profile.sub,
        email: profile.email.toLowerCase(),
        name: profile.name || 'User',
        avatar: profile.picture || null,
      },
    });

    await ensureDefaultSenderForUser(user.id, user.name, user.email);
  }

  return user;
};

export const registerWithEmail = async (email: string, password: string, name?: string) => {
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    throw new Error('User already exists with this email');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: name?.trim() || normalizedEmail.split('@')[0],
      passwordHash,
    },
  });

  await ensureDefaultSenderForUser(user.id, user.name, user.email);

  return user;
};

export const loginWithEmail = async (email: string, password: string) => {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || !user.passwordHash) {
    throw new Error('Invalid email or password');
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    throw new Error('Invalid email or password');
  }

  return user;
};

export const ensureDefaultSenderForUser = async (userId: string, name: string, email: string) => {
  const existingSenders = await prisma.sender.count({
    where: { userId },
  });

  if (existingSenders === 0) {
    await prisma.sender.create({
      data: {
        userId,
        name: name || 'Oliver Brown',
        email: email || 'oliver.brown@domain.io',
        host: env.ETHEREAL_HOST,
        port: env.ETHEREAL_PORT,
        user: env.ETHEREAL_USER || null,
        pass: env.ETHEREAL_PASSWORD || null,
        isDefault: true,
      },
    });
  }
};
