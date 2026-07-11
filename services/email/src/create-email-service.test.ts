import { expect, test } from 'bun:test';
import { createEmailClient } from '@vers/email';
import { server } from '@vers/email/mocks';
import { createDatabaseFromTemplate } from '@vers/service-test-utils/bun';
import { HttpResponse, http } from 'msw';
import * as z from 'zod';
import { createEmailJobQueue } from './create-email-job-queue';
import { createEmailService } from './create-email-service';

const RESEND_ENDPOINT_URL = 'https://api.resend.com/emails';
const SentEmailBodySchema = z.object({ to: z.string() });

test('it boots from env.DATABASE_URL when no queue connection string is injected', async () => {
  const emailService = await createEmailService();

  expect(emailService.service.env.DATABASE_URL).toStartWith('postgres://');
});

test('it isolates the queue to the injected connection string instead of pooling from env.DATABASE_URL', async () => {
  const enqueuedOn = await createDatabaseFromTemplate();
  const isolatedFrom = await createDatabaseFromTemplate();
  const enqueued = await createEmailService({ queueConnectionString: enqueuedOn });
  const isolated = await createEmailService({ queueConnectionString: isolatedFrom });

  await enqueued.queue.start();
  await isolated.queue.start();

  // sent directly through the queue, bypassing the RPC handler's own fire-and-forget drain nudge,
  // so this test's isolation assertion isn't racing that background delivery
  await enqueued.queue.send('send-change-email-notification', { to: 'player@example.com' });

  const isolatedDrain = await isolated.queue.drain('send-change-email-notification');

  expect(isolatedDrain).toStrictEqual({ completed: 0, failed: 0 });

  await enqueued.queue.stop();
  await isolated.queue.stop();
});

test('it delivers a job enqueued while the process was down, once booted and its boot drain runs', async () => {
  const queueConnectionString = await createDatabaseFromTemplate();

  const writerQueue = createEmailJobQueue({
    connectionString: queueConnectionString,
    emailClient: createEmailClient({ apiKey: 'test-api-key', from: 'test@example.com' }),
  });

  await writerQueue.start();

  await writerQueue.send('send-welcome', {
    to: 'player@example.com',
    verificationCode: '123456',
    verificationURL: 'https://versidle.com/verify',
  });

  await writerQueue.stop();

  let capturedTo: unknown;

  server.use(
    http.post(RESEND_ENDPOINT_URL, async (info) => {
      const requestBody = await info.request.json();

      const body = SentEmailBodySchema.parse(requestBody);

      capturedTo = body.to;

      return HttpResponse.json({ id: 'mock-email-id' });
    }),
  );

  const emailService = await createEmailService({ queueConnectionString });

  await emailService.queue.start();
  await emailService.queue.drain();
  await emailService.queue.stop();

  expect(capturedTo).toBe('player@example.com');
});
