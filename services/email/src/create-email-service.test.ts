import { expect, mock, onTestFinished, test } from 'bun:test';
import { getLogger } from '@logtape/logtape';
import type { EmailContract } from '@vers/contract-email';
import { createEmailClient } from '@vers/email';
import { sentEmails } from '@vers/email/mocks';
import { createAnonymousViewer, createDatabaseFromTemplate } from '@vers/service-test-utils/bun';
import { buildRPCTestClient, waitFor } from '@vers/test-utils';
import { createEmailJobQueue } from './create-email-job-queue';
import { createEmailService } from './create-email-service';

test('it boots from env.DATABASE_URL when no queue connection string is injected', async () => {
  const emailService = await createEmailService();

  onTestFinished(() => emailService.stop());

  expect(emailService.env.DATABASE_URL).toStartWith('postgres://');
});

test('it isolates the queue to the injected connection string instead of pooling from env.DATABASE_URL', async () => {
  const enqueuedOn = await createDatabaseFromTemplate();
  const isolatedFrom = await createDatabaseFromTemplate();
  const enqueued = await createEmailService({ queueConnectionString: enqueuedOn });

  onTestFinished(() => enqueued.stop());

  const isolated = await createEmailService({ queueConnectionString: isolatedFrom });

  onTestFinished(() => isolated.stop());

  // sent directly through the queue, bypassing the RPC handler's own fire-and-forget drain nudge,
  // so this test's isolation assertion isn't racing that background delivery
  await enqueued.resources.queue.send('send-change-email-notification', {
    to: 'player@example.com',
  });

  const isolatedDrain = await isolated.resources.queue.drain('send-change-email-notification');

  expect(isolatedDrain).toStrictEqual({ completed: 0, failed: 0 });
});

test('it delivers a job enqueued while the process was down, once it serves and its boot drain runs', async () => {
  const queueConnectionString = await createDatabaseFromTemplate();

  const writerQueue = createEmailJobQueue({
    connectionString: queueConnectionString,
    emailClient: createEmailClient({ apiKey: 'test-api-key', from: 'test@example.com' }),
    logger: getLogger(['test-email-service']),
  });

  await writerQueue.start();

  await writerQueue.send('send-welcome', {
    to: 'player@example.com',
    usefulUntil: new Date(Date.now() + 60_000),
    verificationCode: '123456',
    verificationURL: 'https://versidle.com/verify',
  });

  await writerQueue.stop();

  const emailService = await createEmailService({ queueConnectionString });

  onTestFinished(() => emailService.stop());

  emailService.serve({ exit: () => {}, port: 0 });

  await waitFor(() => {
    expect(sentEmails.get('player@example.com')).toMatchObject({ to: 'player@example.com' });
  });
});

test('it stops serving, stops its job queue and exits 0 on SIGTERM', async () => {
  const exit = mock((_code: number) => {});

  const emailService = await createEmailService({
    queueConnectionString: await createDatabaseFromTemplate(),
  });

  onTestFinished(() => emailService.stop());

  emailService.serve({ exit, port: 0 });
  process.emit('SIGTERM');

  await waitFor(() => {
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  expect(
    emailService.resources.queue.send('send-change-email-notification', {
      to: 'late@example.com',
    }),
  ).rejects.toThrow();
});

test('it accepts a call from app-web', async () => {
  const emailService = await createEmailService({
    queueConnectionString: await createDatabaseFromTemplate(),
  });

  onTestFinished(() => emailService.stop());

  const viewer = await createAnonymousViewer({ audience: 'service-email', issuer: 'app-web' });

  const client = buildRPCTestClient<EmailContract>(emailService.app, {
    token: viewer.token,
  });

  const usefulUntil = new Date(Date.now() + 60_000);

  await expect(
    client.sendWelcome({
      to: 'accepted@example.com',
      usefulUntil,
      verificationCode: '123456',
      verificationURL: 'https://versidle.com/verify',
    }),
  ).toResolve();

  await emailService.resources.queue.drain();
});

test('it rejects a call from service-activity with 403', async () => {
  const emailService = await createEmailService();

  onTestFinished(() => emailService.stop());

  const viewer = await createAnonymousViewer({
    audience: 'service-email',
    issuer: 'service-activity',
  });

  const response = await emailService.app.handle(
    new Request('http://test.local/rpc/sendWelcome', {
      headers: { authorization: `Bearer ${viewer.token}` },
      method: 'POST',
    }),
  );

  expect(response.status).toBe(403);
});
