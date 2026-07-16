import { expect, onTestFinished, test } from 'bun:test';
import { createEmailClient } from '@vers/email';
import { RESEND_ENDPOINT_URL, server } from '@vers/email/mocks';
import { createDatabaseFromTemplate } from '@vers/service-test-utils/bun';
import { HttpResponse, http } from 'msw';
import { createEmailJobQueue } from './create-email-job-queue';

test('it invokes the passed-through onJobFailed when a send job fails', async () => {
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
    onJobFailed: (_error, context) => {
      failures.push({ name: context.name, retriesExhausted: context.retriesExhausted });
    },
  });

  await queue.start();

  onTestFinished(() => queue.stop());

  await queue.send('send-welcome', {
    to: 'player@example.com',
    verificationCode: '123456',
    verificationURL: 'https://versidle.com/verify',
  });

  await queue.drain('send-welcome');

  expect(failures).toStrictEqual([{ name: 'send-welcome', retriesExhausted: false }]);
});
