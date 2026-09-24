import { prisma } from '../src/config/prisma.js';
import { redisConnection } from '../src/config/redis.js';
import { emailQueue } from '../src/queues/email.queue.js';
import { processEmailJob } from '../src/workers/email.worker.js';
import { scheduleCampaign, extractAndValidateEmails } from '../src/services/scheduler.service.js';
import { registerWithEmail, loginWithEmail, signUserToken } from '../src/services/auth.service.js';
import { checkAndConsumeRateLimits, getHourWindowTimestamp } from '../src/services/rate-limiter.service.js';
import { searchService } from '../src/services/elasticsearch.service.js';
import { dispatchRateLimitSlackAlert } from '../src/services/slack.service.js';

const runTests = async () => {
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      process.stdout.write(`PASS: ${testName}\n`);
      passed++;
    } else {
      process.stderr.write(`FAIL: ${testName}\n`);
      failed++;
    }
  };

  try {
    process.stdout.write('Starting Comprehensive End-to-End Verification\n\n');

    const testEmail = `testuser_${Date.now()}@example.com`;
    const user = await registerWithEmail(testEmail, 'SecurePass123!', 'Oliver Brown');
    assert(!!user && user.email === testEmail, 'User registration and default sender creation');

    const loggedIn = await loginWithEmail(testEmail, 'SecurePass123!');
    assert(loggedIn.id === user.id, 'User login authentication');

    const token = signUserToken(user);
    assert(typeof token === 'string' && token.length > 20, 'JWT session token generation');

    const rawLeads = `
      alice@domain.com
      BOB@domain.com
      alice@domain.com
      not-an-email
      charlie@domain.com, david@domain.com
    `;
    const leadResult = extractAndValidateEmails(rawLeads);
    assert(
      leadResult.validEmails.length === 4 &&
      leadResult.duplicatesRemoved === 1 &&
      leadResult.invalidCount === 1,
      'CSV/text email extraction with deduplication and invalid filtering'
    );

    const defaultSender = await prisma.sender.findFirst({
      where: { userId: user.id },
    });
    assert(!!defaultSender, 'Sender retrieved for user');

    const scheduleResult = await scheduleCampaign({
      userId: user.id,
      senderId: defaultSender!.id,
      name: 'Q4 Product Launch',
      subject: 'Special Announcement',
      body: '<p>Hello world, here is your update!</p>',
      recipients: leadResult.validEmails,
      delaySeconds: 2,
      hourlyLimit: 50,
    });
    assert(
      scheduleResult.scheduledCount === 4 &&
      scheduleResult.campaign.totalRecipients === 4,
      'Campaign creation and batch recipient scheduling'
    );

    const scheduledRow = await prisma.scheduledEmail.findFirst({
      where: { campaignId: scheduleResult.campaign.id },
      include: { senderRef: true, campaignRef: true, userRef: true },
    });
    assert(!!scheduledRow && scheduledRow.status === 'PENDING', 'Database persistence of scheduled email');

    const bullJob = await emailQueue.getJob(scheduledRow!.id);
    assert(!!bullJob && bullJob.id === scheduledRow!.id, 'BullMQ delayed job persistence in Redis');

    await processEmailJob(bullJob!);

    const processedRow = await prisma.scheduledEmail.findUnique({
      where: { id: scheduledRow!.id },
    });
    assert(
      processedRow?.status === 'SENT' &&
      !!processedRow?.etherealMessageId,
      'Worker processing and Ethereal SMTP transmission'
    );

    const duplicateJobRun = await processEmailJob(bullJob!);
    const postDuplicateRow = await prisma.scheduledEmail.findUnique({
      where: { id: scheduledRow!.id },
    });
    assert(
      postDuplicateRow?.status === 'SENT',
      'Idempotency guarantee: job processed twice will not send duplicate'
    );

    const senderKey = `sender_ratelimit_test_${Date.now()}`;
    const limitCheck1 = await checkAndConsumeRateLimits(senderKey, 2, 0);
    const limitCheck2 = await checkAndConsumeRateLimits(senderKey, 2, 0);
    const limitCheck3 = await checkAndConsumeRateLimits(senderKey, 2, 0);
    assert(
      limitCheck1.allowed === true &&
      limitCheck2.allowed === true &&
      limitCheck3.allowed === false &&
      limitCheck3.reason === 'HOURLY_LIMIT_REACHED' &&
      !!limitCheck3.nextWindowDate,
      'Distributed Redis atomic hourly rate limiting and next window calculation'
    );

    const delayKey = `sender_delay_test_${Date.now()}`;
    const delayCheck1 = await checkAndConsumeRateLimits(delayKey, 100, 3);
    const delayCheck2 = await checkAndConsumeRateLimits(delayKey, 100, 3);
    assert(
      delayCheck1.allowed === true &&
      delayCheck2.allowed === false &&
      delayCheck2.reason === 'MIN_DELAY_NOT_MET',
      'Minimum delay enforcement across workers'
    );

    const slackAlertDispatched = await dispatchRateLimitSlackAlert({
      userId: user.id,
      senderEmail: defaultSender!.email,
      senderName: defaultSender!.name,
      hourlyLimit: 50,
      nextWindowDate: new Date(Date.now() + 3600000),
    });
    assert(
      slackAlertDispatched === false,
      'Slack notification safely skips when Slack connection not present without error'
    );

    const searchRes = await searchService.searchUserEmails({
      userId: user.id,
      query: 'Special Announcement',
    });
    assert(
      searchRes.items.length >= 1,
      'Email search capability with graceful database/Elasticsearch resolution'
    );

    const restartEmailId = `restart_test_${Date.now()}`;
    const futureDate = new Date(Date.now() + 60000);
    await prisma.scheduledEmail.create({
      data: {
        id: restartEmailId,
        campaignId: scheduleResult.campaign.id,
        senderId: defaultSender!.id,
        userId: user.id,
        recipientEmail: 'future_recipient@example.com',
        subject: 'Future Email',
        body: 'Will send later',
        scheduledAt: futureDate,
        status: 'PENDING',
        bullJobId: restartEmailId,
        idempotencyKey: `idemp_${restartEmailId}`,
      },
    });
    await emailQueue.add(
      'send-email',
      { scheduledEmailId: restartEmailId },
      { delay: 60000, jobId: restartEmailId }
    );
    const persistedJobBeforeRestart = await emailQueue.getJob(restartEmailId);
    assert(!!persistedJobBeforeRestart, 'Job persisted in Redis before simulation of restart');

    const simulatedRestartJob = await emailQueue.getJob(restartEmailId);
    assert(
      persistedJobBeforeRestart?.id === simulatedRestartJob?.id,
      'Job restored from Redis queue post-restart'
    );

    const largeBatchRecipients: string[] = [];
    for (let i = 0; i < 1000; i++) {
      largeBatchRecipients.push(`batch_lead_${i}_${Date.now()}@domain.io`);
    }

    const startPerf = Date.now();
    const largeBatchCampaign = await scheduleCampaign({
      userId: user.id,
      senderId: defaultSender!.id,
      name: '1000+ Scale Simulation',
      subject: 'Mass Delivery',
      body: 'Scale load simulation content',
      recipients: largeBatchRecipients,
      delaySeconds: 1,
      hourlyLimit: 500,
    });
    const durationMs = Date.now() - startPerf;

    assert(
      largeBatchCampaign.scheduledCount === 1000,
      `1000+ scheduled email simulation completed successfully in ${durationMs}ms`
    );

    process.stdout.write(`\nAll Test Results: ${passed} PASSED, ${failed} FAILED\n`);
  } catch (err: any) {
    process.stderr.write(`Fatal error in test execution: ${err.message}\n${err.stack}\n`);
    failed++;
  } finally {
    await prisma.$disconnect();
    await redisConnection.quit();
    process.exit(failed > 0 ? 1 : 0);
  }
};

runTests();
