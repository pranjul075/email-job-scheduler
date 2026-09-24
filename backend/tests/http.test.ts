import http from 'http';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { redisConnection } from '../src/config/redis.js';

const runHttpTests = async () => {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(4001, () => resolve());
  });

  const baseUrl = 'http://localhost:4001';
  let cookieHeader = '';

  const assert = (condition: boolean, msg: string) => {
    if (condition) {
      process.stdout.write(`PASS: ${msg}\n`);
    } else {
      process.stderr.write(`FAIL: ${msg}\n`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  };

  try {
    process.stdout.write('Running HTTP API Integration Tests\n\n');

    const healthRes = await fetch(`${baseUrl}/health`);
    const healthJson = (await healthRes.json()) as any;
    assert(healthRes.status === 200 && healthJson.status === 'ok', 'GET /health endpoint');

    const queuesRes = await fetch(`${baseUrl}/admin/queues/`);
    assert(queuesRes.status === 200, 'GET /admin/queues Bull Board endpoint');

    const uniqueEmail = `http_user_${Date.now()}@example.com`;
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'Password123!',
        name: 'Oliver Brown',
      }),
    });
    const regJson = (await regRes.json()) as any;
    assert(regRes.status === 201 && !!regJson.user, 'POST /api/auth/register endpoint');

    const rawCookies = regRes.headers.get('set-cookie');
    assert(!!rawCookies && rawCookies.includes('auth_token='), 'HTTP-only auth_token cookie issued');
    cookieHeader = rawCookies!.split(';')[0];

    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookieHeader },
    });
    const meJson = (await meRes.json()) as any;
    assert(meRes.status === 200 && meJson.user.email === uniqueEmail, 'GET /api/auth/me authenticated');

    const unauthRes = await fetch(`${baseUrl}/api/auth/me`);
    assert(unauthRes.status === 401, 'GET /api/auth/me unauthenticated protection');

    const sendersRes = await fetch(`${baseUrl}/api/senders`, {
      headers: { Cookie: cookieHeader },
    });
    const sendersJson = (await sendersRes.json()) as any;
    assert(sendersRes.status === 200 && Array.isArray(sendersJson.senders), 'GET /api/senders');

    const senderId = sendersJson.senders[0]?.id;
    assert(!!senderId, 'Auto-provisioned default sender exists');

    const scheduleRes = await fetch(`${baseUrl}/api/schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        senderId,
        subject: 'HTTP Integration Test Email',
        body: '<p>Testing HTTP scheduling</p>',
        recipients: ['http_recipient1@domain.com', 'http_recipient2@domain.com'],
        delaySeconds: 2,
        hourlyLimit: 100,
      }),
    });
    const scheduleJson = (await scheduleRes.json()) as any;
    assert(scheduleRes.status === 201 && scheduleJson.scheduledCount === 2, 'POST /api/schedules');

    const scheduledRes = await fetch(`${baseUrl}/api/emails/scheduled`, {
      headers: { Cookie: cookieHeader },
    });
    const scheduledJson = (await scheduledRes.json()) as any;
    assert(
      scheduledRes.status === 200 && scheduledJson.items.length >= 2,
      'GET /api/emails/scheduled'
    );

    const countsRes = await fetch(`${baseUrl}/api/emails/counts`, {
      headers: { Cookie: cookieHeader },
    });
    const countsJson = (await countsRes.json()) as any;
    assert(countsRes.status === 200 && countsJson.scheduledCount >= 2, 'GET /api/emails/counts');

    const searchRes = await fetch(`${baseUrl}/api/emails/search?q=HTTP`, {
      headers: { Cookie: cookieHeader },
    });
    const searchJson = (await searchRes.json()) as any;
    assert(searchRes.status === 200 && searchJson.items.length >= 1, 'GET /api/emails/search');

    const slackStatusRes = await fetch(`${baseUrl}/api/slack/status`, {
      headers: { Cookie: cookieHeader },
    });
    const slackStatusJson = (await slackStatusRes.json()) as any;
    assert(slackStatusRes.status === 200 && typeof slackStatusJson.connected === 'boolean', 'GET /api/slack/status');

    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookieHeader },
    });
    assert(logoutRes.status === 200, 'POST /api/auth/logout');

    process.stdout.write('\nAll HTTP Integration Tests Passed Successfully!\n');
  } finally {
    server.close();
    await prisma.$disconnect();
    await redisConnection.quit();
  }
};

runHttpTests();
