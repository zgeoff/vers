import { expect, onTestFinished, test } from 'bun:test';
import { getLogger } from '@logtape/logtape';
import { createEmailClient } from '@vers/email';
import { RESEND_ENDPOINT_URL, sentEmails, server } from '@vers/email/mocks';
import { createDatabaseFromTemplate } from '@vers/service-test-utils/bun';
import { createInMemoryLogs, createInMemoryMetrics } from '@vers/test-utils/bun';
import { HttpResponse, http } from 'msw';
import { EMAIL_JOB_DEFS, createEmailJobQueue } from './create-email-job-queue';

test('it reports a failed email delivery to the failure callback', async () => {
  const connectionString = await createDatabaseFromTemplate();

  server.use(
    http.post(
      RESEND_ENDPOINT_URL,
      () =>
        HttpResponse.json(
          { message: 'rate limited', name: 'rate_limit_exceeded' },
          { status: 429 },
        ),
      { once: true },
    ),
  );

  const failures: Array<{ name: string; retriesExhausted: boolean }> = [];

  const queue = createEmailJobQueue({
    connectionString,
    emailClient: createEmailClient({ apiKey: 'test-api-key', from: 'test@example.com' }),
    logger: getLogger(['test-email-job-queue']),
    onJobFailed: (_error, context) => {
      failures.push({ name: context.name, retriesExhausted: context.retriesExhausted });
    },
  });

  await queue.start();

  onTestFinished(() => queue.stop());

  await queue.send('send-welcome', {
    to: 'player@example.com',
    usefulUntil: new Date(Date.now() + 60_000),
    verificationCode: '123456',
    verificationURL: 'https://versidle.com/verify',
  });

  await queue.drain('send-welcome');

  expect(failures).toStrictEqual([{ name: 'send-welcome', retriesExhausted: false }]);
});

test('it sends a welcome email whose deadline is in the future', async () => {
  const connectionString = await createDatabaseFromTemplate();

  const queue = createEmailJobQueue({
    connectionString,
    emailClient: createEmailClient({ apiKey: 'test-api-key', from: 'test@example.com' }),
    logger: getLogger(['test-email-job-queue']),
  });

  await queue.start();

  onTestFinished(() => queue.stop());

  await queue.send('send-welcome', {
    to: 'deadline-future@example.com',
    usefulUntil: new Date(Date.now() + 60_000),
    verificationCode: '123456',
    verificationURL: 'https://versidle.com/verify',
  });

  const drained = await queue.drain('send-welcome');

  expect(drained).toStrictEqual({ completed: 1, failed: 0 });
  expect(sentEmails.get('deadline-future@example.com')).toBeDefined();
});

test('it skips a welcome email whose deadline has passed', async () => {
  const connectionString = await createDatabaseFromTemplate();

  const metrics = createInMemoryMetrics();

  const queue = createEmailJobQueue({
    connectionString,
    emailClient: createEmailClient({ apiKey: 'test-api-key', from: 'test@example.com' }),
    logger: getLogger(['test-email-job-queue']),
  });

  await queue.start();

  onTestFinished(() => queue.stop());

  await queue.send('send-welcome', {
    to: 'deadline-past@example.com',
    usefulUntil: new Date(Date.now() - 1000),
    verificationCode: '123456',
    verificationURL: 'https://versidle.com/verify',
  });

  const drained = await queue.drain('send-welcome');

  expect(drained).toStrictEqual({ completed: 1, failed: 0 });
  expect(sentEmails.get('deadline-past@example.com')).toBeUndefined();

  const expiredSends = await metrics.readCounterDataPoints('vers.email.expired_sends');

  expect(expiredSends).toIncludeAllPartialMembers([
    { attributes: { template: 'send-welcome' }, value: 1 },
  ]);
});

test('it skips a change-email verification whose deadline has passed', async () => {
  const connectionString = await createDatabaseFromTemplate();

  const metrics = createInMemoryMetrics();

  const queue = createEmailJobQueue({
    connectionString,
    emailClient: createEmailClient({ apiKey: 'test-api-key', from: 'test@example.com' }),
    logger: getLogger(['test-email-job-queue']),
  });

  await queue.start();

  onTestFinished(() => queue.stop());

  await queue.send('send-change-email-verification', {
    newEmail: 'deadline-past-new@example.com',
    to: 'deadline-past@example.com',
    usefulUntil: new Date(Date.now() - 1000),
    verificationCode: '123456',
    verificationURL: 'https://versidle.com/verify',
  });

  const drained = await queue.drain('send-change-email-verification');

  expect(drained).toStrictEqual({ completed: 1, failed: 0 });
  expect(sentEmails.get('deadline-past@example.com')).toBeUndefined();

  const expiredSends = await metrics.readCounterDataPoints('vers.email.expired_sends');

  expect(expiredSends).toIncludeAllPartialMembers([
    { attributes: { template: 'send-change-email-verification' }, value: 1 },
  ]);
});

test('it logs a warn line for an email skipped past its deadline', async () => {
  const connectionString = await createDatabaseFromTemplate();

  const logs = createInMemoryLogs({ lowestLevel: 'warning' });

  const queue = createEmailJobQueue({
    connectionString,
    emailClient: createEmailClient({ apiKey: 'test-api-key', from: 'test@example.com' }),
    logger: getLogger(['test-email-job-queue']),
  });

  await queue.start();

  onTestFinished(() => queue.stop());

  await queue.send('send-welcome', {
    to: 'deadline-past@example.com',
    usefulUntil: new Date(Date.now() - 1000),
    verificationCode: '123456',
    verificationURL: 'https://versidle.com/verify',
  });

  await queue.drain('send-welcome');

  expect(logs.records).toHaveLength(1);

  expect(logs.records[0]).toMatchObject({
    level: 'warning',
    properties: { queue: 'send-welcome' },
    rawMessage: 'email skipped past its deadline',
  });
});

test('it keeps a logger below warn quiet for an email skipped past its deadline', async () => {
  const connectionString = await createDatabaseFromTemplate();

  const logs = createInMemoryLogs({ lowestLevel: 'error' });

  const queue = createEmailJobQueue({
    connectionString,
    emailClient: createEmailClient({ apiKey: 'test-api-key', from: 'test@example.com' }),
    logger: getLogger(['test-email-job-queue']),
  });

  await queue.start();

  onTestFinished(() => queue.stop());

  await queue.send('send-welcome', {
    to: 'deadline-past@example.com',
    usefulUntil: new Date(Date.now() - 1000),
    verificationCode: '123456',
    verificationURL: 'https://versidle.com/verify',
  });

  await queue.drain('send-welcome');

  expect(logs.records).toBeEmpty();
});

test('it defines the deadline-bearing jobs with the timely retry schedule', () => {
  const deadlineSchedule = {
    deadLetter: true,
    expireInSeconds: 60,
    retryBackoff: true,
    retryDelay: 15,
    retryLimit: 4,
  };

  expect(EMAIL_JOB_DEFS['send-welcome']).toMatchObject(deadlineSchedule);
  expect(EMAIL_JOB_DEFS['send-change-email-verification']).toMatchObject(deadlineSchedule);
});
