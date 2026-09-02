import { expect, onTestFinished, test } from 'bun:test';
import { call } from '@orpc/server';
import type { ErrorEvent } from '@sentry/bun';
import type { EmailContract } from '@vers/contract-email';
import { RESEND_ENDPOINT_URL, sentEmails, server } from '@vers/email/mocks';
import type { JobQueue } from '@vers/jobs';
import {
  createLogger,
  setSentryHandleForTesting,
  startErrorReporting,
} from '@vers/service-runtime';
import { createAnonymousViewer, createDatabaseFromTemplate } from '@vers/service-test-utils/bun';
import { withTraceContext } from '@vers/service-utils';
import { buildRPCTestClient, waitFor } from '@vers/test-utils';
import { createTraceContext } from '@vers/trace';
import { HttpResponse, http } from 'msw';
import { buildEmailRouter } from './build-router';
import type { EmailJobDefs } from './create-email-job-queue';
import { createEmailService } from './create-email-service';

async function setupTest() {
  const queueConnectionString = await createDatabaseFromTemplate();
  const emailService = await createEmailService({ queueConnectionString });

  await emailService.queue.start();

  const viewer = await createAnonymousViewer({ audience: 'service-email' });

  const client = buildRPCTestClient<EmailContract>(emailService.service.app, {
    token: viewer.token,
  });

  return {
    client,
    queue: emailService.queue,
    [Symbol.asyncDispose]: () => emailService.queue.stop(),
  };
}

test('#sendWelcome it enqueues and returns a job id', async () => {
  await using ctx = await setupTest();

  const result = await ctx.client.sendWelcome({
    to: 'player@example.com',
    verificationCode: '123456',
    verificationURL: 'https://versidle.com/verify',
  });

  expect(result.jobID).toBeString();
});

test('#sendWelcome it delivers the email on drain, sending the job id as the idempotency key', async () => {
  await using ctx = await setupTest();

  const result = await ctx.client.sendWelcome({
    to: 'player@example.com',
    verificationCode: '123456',
    verificationURL: 'https://versidle.com/verify',
  });

  await ctx.queue.drain('send-welcome');

  await waitFor(
    () => {
      expect(sentEmails.get('player@example.com')).toBeDefined();
    },
    { timeoutMs: 5000 },
  );

  expect(sentEmails.get('player@example.com')).toMatchObject({
    idempotencyKey: result.jobID,
    to: 'player@example.com',
  });
});

test('#sendWelcome it rejects invalid input', async () => {
  await using ctx = await setupTest();

  // @ts-expect-error -- exercising the runtime rejection of input the type system would reject too
  const sent = ctx.client.sendWelcome({ to: 'not-an-email', verificationCode: '123456' });

  expect(sent).rejects.toMatchObject({ code: 'BAD_REQUEST' });
});

test('#sendExistingAccount it enqueues and delivers with the tried-to-signup address as a prop', async () => {
  await using ctx = await setupTest();

  const result = await ctx.client.sendExistingAccount({
    email: 'existing@example.com',
    to: 'existing@example.com',
  });

  await ctx.queue.drain('send-existing-account');

  await waitFor(
    () => {
      expect(sentEmails.get('existing@example.com')).toBeDefined();
    },
    { timeoutMs: 5000 },
  );

  expect(sentEmails.get('existing@example.com')).toMatchObject({
    idempotencyKey: result.jobID,
    to: 'existing@example.com',
  });
});

test('#sendChangeEmailVerification it enqueues and delivers to the account s current address', async () => {
  await using ctx = await setupTest();

  const result = await ctx.client.sendChangeEmailVerification({
    newEmail: 'new@example.com',
    to: 'old@example.com',
    verificationCode: '123456',
    verificationURL: 'https://versidle.com/verify-email',
  });

  await ctx.queue.drain('send-change-email-verification');

  await waitFor(
    () => {
      expect(sentEmails.get('old@example.com')).toBeDefined();
    },
    { timeoutMs: 5000 },
  );

  expect(sentEmails.get('old@example.com')).toMatchObject({
    idempotencyKey: result.jobID,
    to: 'old@example.com',
  });
});

test('#sendChangeEmailNotification it enqueues and delivers with no props beyond the recipient', async () => {
  await using ctx = await setupTest();

  const result = await ctx.client.sendChangeEmailNotification({ to: 'player@example.com' });

  await ctx.queue.drain('send-change-email-notification');

  await waitFor(
    () => {
      expect(sentEmails.get('player@example.com')).toBeDefined();
    },
    { timeoutMs: 5000 },
  );

  expect(sentEmails.get('player@example.com')).toMatchObject({
    idempotencyKey: result.jobID,
    to: 'player@example.com',
  });
});

test('#sendResetPassword it enqueues and delivers', async () => {
  await using ctx = await setupTest();

  const result = await ctx.client.sendResetPassword({
    resetURL: 'https://versidle.com/reset-password',
    to: 'player@example.com',
  });

  await ctx.queue.drain('send-reset-password');

  await waitFor(
    () => {
      expect(sentEmails.get('player@example.com')).toBeDefined();
    },
    { timeoutMs: 5000 },
  );

  expect(sentEmails.get('player@example.com')).toMatchObject({
    idempotencyKey: result.jobID,
    to: 'player@example.com',
  });
});

test('#sendPasswordChanged it enqueues and delivers', async () => {
  await using ctx = await setupTest();

  const result = await ctx.client.sendPasswordChanged({
    email: 'player@example.com',
    to: 'player@example.com',
  });

  await ctx.queue.drain('send-password-changed');

  await waitFor(
    () => {
      expect(sentEmails.get('player@example.com')).toBeDefined();
    },
    { timeoutMs: 5000 },
  );

  expect(sentEmails.get('player@example.com')).toMatchObject({
    idempotencyKey: result.jobID,
    to: 'player@example.com',
  });
});

test('it keeps a job left failed by a downstream error for a later sweep', async () => {
  await using ctx = await setupTest();

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

  await ctx.queue.send('send-welcome', {
    to: 'player@example.com',
    verificationCode: '123456',
    verificationURL: 'https://versidle.com/verify',
  });

  const firstDrain = await ctx.queue.drain('send-welcome');

  expect(firstDrain).toStrictEqual({ completed: 0, failed: 1 });

  // the failed job is neither delivered nor lost — it sits out its retry delay, invisible to a
  // drain that runs before the delay elapses; delivery after the delay is the queue package's
  // own tested contract
  const backoffDrain = await ctx.queue.drain('send-welcome');

  expect(backoffDrain).toStrictEqual({ completed: 0, failed: 0 });
});

test('it reports a fire-and-forget drain failure carrying the active trace id', async () => {
  const recorded: Array<Readonly<ErrorEvent>> = [];
  const previousHandle = setSentryHandleForTesting(undefined);

  onTestFinished(() => {
    setSentryHandleForTesting(previousHandle);
  });

  await startErrorReporting('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: (event) => {
      recorded.push(event);

      return null;
    },
    disableDefaultIntegrations: true,
  });

  const logger = createLogger({ level: 'fatal', name: 'test-email-router' });

  const stubQueue: JobQueue<EmailJobDefs> = {
    drain: () => Promise.reject(new Error('drain failed')),
    send: () => Promise.resolve('job-1'),
    start: () => Promise.resolve(),
    stop: () => Promise.resolve(),
  };

  const router = buildEmailRouter({ logger, queue: stubQueue });
  const trace = createTraceContext();

  await withTraceContext(trace, () =>
    call(
      router.sendWelcome,
      {
        to: 'player@example.com',
        verificationCode: '123456',
        verificationURL: 'https://versidle.com/verify',
      },
      {
        context: {
          actingSessionID: null,
          actingUserID: null,
          logger,
          traceID: trace.traceID,
        },
      },
    ),
  );

  await waitFor(() => {
    expect(recorded).toHaveLength(1);
  });

  expect(recorded[0]?.tags).toMatchObject({ traceID: trace.traceID });
});
