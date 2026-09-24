import { prisma } from '../config/prisma.js';
import { redisConnection } from '../config/redis.js';
import { env } from '../config/env.js';
import { getHourWindowTimestamp } from './rate-limiter.service.js';

export const getSlackAuthorizeUrl = (userId: string): string => {
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: 'chat:write,incoming-webhook,channels:read',
    redirect_uri: env.SLACK_REDIRECT_URI,
    state: userId,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
};

export const handleSlackOAuthCallback = async (code: string, userId: string) => {
  const formData = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    client_secret: env.SLACK_CLIENT_SECRET,
    code,
    redirect_uri: env.SLACK_REDIRECT_URI,
  });

  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  const data = (await response.json()) as {
    ok: boolean;
    error?: string;
    access_token?: string;
    scope?: string;
    team?: { id: string; name: string };
    incoming_webhook?: {
      url: string;
      channel: string;
      channel_id: string;
    };
    authed_user?: { id: string };
  };

  if (!data.ok || !data.access_token || !data.team) {
    throw new Error(data.error || 'Failed to exchange Slack OAuth code');
  }

  return await prisma.slackConnection.upsert({
    where: { userId },
    create: {
      userId,
      teamId: data.team.id,
      teamName: data.team.name,
      channelId: data.incoming_webhook?.channel_id || null,
      channelName: data.incoming_webhook?.channel || null,
      accessToken: data.access_token,
      botUserId: data.authed_user?.id || null,
      webhookUrl: data.incoming_webhook?.url || null,
      scope: data.scope || null,
    },
    update: {
      teamId: data.team.id,
      teamName: data.team.name,
      channelId: data.incoming_webhook?.channel_id || null,
      channelName: data.incoming_webhook?.channel || null,
      accessToken: data.access_token,
      botUserId: data.authed_user?.id || null,
      webhookUrl: data.incoming_webhook?.url || null,
      scope: data.scope || null,
    },
  });
};

export const getSlackStatusForUser = async (userId: string) => {
  const connection = await prisma.slackConnection.findUnique({
    where: { userId },
  });

  if (!connection) {
    return {
      connected: false,
      teamName: null,
      channelName: null,
    };
  }

  return {
    connected: true,
    teamName: connection.teamName,
    channelName: connection.channelName,
  };
};

export const disconnectSlackForUser = async (userId: string) => {
  await prisma.slackConnection.deleteMany({
    where: { userId },
  });
};

export interface RateLimitSlackAlertOptions {
  userId: string;
  senderEmail: string;
  senderName: string;
  hourlyLimit: number;
  nextWindowDate: Date;
  affectedCount?: number;
}

export const testSlackWebhookForUser = async (userId: string) => {
  const connection = await prisma.slackConnection.findUnique({
    where: { userId },
  });

  if (!connection) {
    console.log('SLACK_CONNECTION_NOT_FOUND', { userId });
    return { success: false, error: 'Slack is not connected' };
  }

  const timestamp = new Date().toISOString();
  const testText = `TEST - ReachInbox rate limit notification - ${timestamp}`;

  if (connection.webhookUrl) {
    console.log('SLACK_WEBHOOK_REQUEST_STARTED');
    try {
      const response = await fetch(connection.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testText }),
      });

      const bodyText = await response.text().catch(() => '');
      console.log('SLACK_WEBHOOK_RESPONSE', {
        status: response.status,
        body: bodyText,
      });

      if (response.ok && bodyText === 'ok') {
        console.log('SLACK_MESSAGE_SUCCESS');
        return { success: true, status: response.status, body: bodyText, timestamp };
      }

      console.log('SLACK_MESSAGE_FAILED', {
        status: response.status,
        error: bodyText,
      });
      return { success: false, status: response.status, body: bodyText, timestamp };
    } catch (err: any) {
      console.log('SLACK_MESSAGE_FAILED', { error: err?.message });
      return { success: false, error: err?.message, timestamp };
    }
  }

  if (connection.accessToken && connection.channelId) {
    try {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${connection.accessToken}`,
        },
        body: JSON.stringify({
          channel: connection.channelId,
          text: testText,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        ok: boolean;
        error?: string;
      };
      if (data.ok) {
        console.log('SLACK_MESSAGE_SUCCESS');
        return { success: true, status: response.status, body: 'ok', timestamp };
      }

      console.log('SLACK_MESSAGE_FAILED', { error: data.error });
      return { success: false, error: data.error, timestamp };
    } catch (err: any) {
      console.log('SLACK_MESSAGE_FAILED', { error: err?.message });
      return { success: false, error: err?.message, timestamp };
    }
  }

  return { success: false, error: 'No webhook URL or channel configured' };
};

export const dispatchRateLimitSlackAlert = async (
  options: RateLimitSlackAlertOptions
): Promise<boolean> => {
  const hourTs = getHourWindowTimestamp();
  const alertKey = `slack_alert_sent:${options.userId}:${options.senderEmail}:${hourTs}`;

  try {
    console.log('SLACK_NOTIFICATION_TRIGGERED', {
      userId: options.userId,
      sender: options.senderEmail,
      limit: options.hourlyLimit,
    });

    const acquired = await redisConnection.set(alertKey, '1', 'EX', 3600, 'NX');
    if (!acquired) {
      return false;
    }

    const connection = await prisma.slackConnection.findUnique({
      where: { userId: options.userId },
    });

    if (!connection) {
      console.log('SLACK_CONNECTION_NOT_FOUND', { userId: options.userId });
      await redisConnection.del(alertKey);
      return false;
    }

    console.log('SLACK_CONNECTION_FOUND', {
      userId: options.userId,
      teamName: connection.teamName,
      channelName: connection.channelName,
    });

    const destinationDesc = connection.webhookUrl ? 'webhook' : 'chat.postMessage';
    console.log('SLACK_MESSAGE_ATTEMPTED', {
      method: destinationDesc,
      channel: connection.channelName || connection.channelId || 'default',
    });

    const testTimestamp = new Date().toISOString();
    const fallbackText = `TEST - ReachInbox rate limit notification - ${testTimestamp} | Rate limit reached for sender ${options.senderName} (${options.senderEmail}). Limit: ${options.hourlyLimit}/hr. Emails affected: ${options.affectedCount ?? 1}. Resuming at ${options.nextWindowDate.toISOString()}.`;

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚠️ Email Rate Limit Reached',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*TEST - ReachInbox rate limit notification - ${testTimestamp}*`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Sender:*\n${options.senderName} (\`${options.senderEmail}\`)`,
          },
          {
            type: 'mrkdwn',
            text: `*Hourly Limit:*\n${options.hourlyLimit} emails/hour`,
          },
          {
            type: 'mrkdwn',
            text: `*Affected / Delayed:*\n${options.affectedCount ?? 1} emails`,
          },
          {
            type: 'mrkdwn',
            text: `*Resuming Window:*\n\`${options.nextWindowDate.toUTCString()}\``,
          },
        ],
      },
    ];

    let delivered = false;

    if (connection.webhookUrl) {
      console.log('SLACK_WEBHOOK_REQUEST_STARTED');
      const response = await fetch(connection.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: fallbackText,
          blocks,
        }),
      });

      const resBody = await response.text().catch(() => '');
      console.log('SLACK_WEBHOOK_RESPONSE', {
        status: response.status,
        body: resBody,
      });

      if (response.ok && resBody === 'ok') {
        console.log('SLACK_MESSAGE_SUCCESS');
        delivered = true;
      } else {
        console.log('SLACK_MESSAGE_FAILED', {
          destination: 'webhook',
          status: response.status,
          error: resBody,
        });
      }
    }

    if (connection.accessToken) {
      if (connection.channelId) {
        const chanRes = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${connection.accessToken}`,
          },
          body: JSON.stringify({
            channel: connection.channelId,
            text: fallbackText,
            blocks,
          }),
        });

        const chanData = (await chanRes.json().catch(() => ({}))) as {
          ok: boolean;
          error?: string;
        };

        if (chanData.ok) {
          console.log('SLACK_MESSAGE_SUCCESS', { channel: connection.channelId });
          delivered = true;
        } else if (chanData.error === 'not_in_channel' && connection.botUserId) {
          const dmRes = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${connection.accessToken}`,
            },
            body: JSON.stringify({
              channel: connection.botUserId,
              text: fallbackText,
              blocks,
            }),
          });
          const dmData = (await dmRes.json().catch(() => ({}))) as {
            ok: boolean;
            error?: string;
          };
          if (dmData.ok) {
            console.log('SLACK_MESSAGE_SUCCESS', { channel: 'direct_message' });
            delivered = true;
          }
        }
      } else if (connection.botUserId) {
        const dmRes = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${connection.accessToken}`,
          },
          body: JSON.stringify({
            channel: connection.botUserId,
            text: fallbackText,
            blocks,
          }),
        });
        const dmData = (await dmRes.json().catch(() => ({}))) as {
          ok: boolean;
          error?: string;
        };
        if (dmData.ok) {
          console.log('SLACK_MESSAGE_SUCCESS', { channel: 'direct_message' });
          delivered = true;
        }
      }
    }

    if (!delivered) {
      await redisConnection.del(alertKey);
      return false;
    }

    return true;
  } catch (error: any) {
    console.log('SLACK_MESSAGE_FAILED', {
      error: error?.message || 'Unexpected exception during Slack notification',
    });
    await redisConnection.del(alertKey).catch(() => {});
    return false;
  }
};
