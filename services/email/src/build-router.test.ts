import { expect, test } from 'bun:test';
import type { EmailContract } from '@vers/contract-email';
import { server } from '@vers/email/mocks';
import { createAnonymousViewer, createDatabaseFromTemplate } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { HttpResponse, http } from 'msw';
import * as z from 'zod';
import { createEmailService } from './create-email-service';

const RESEND_ENDPOINT_URL = 'https://api.resend.com/emails';
const SentEmailBodySchema = z.object({ to: z.string() });

interface CapturedDelivery {
  readonly idempotencyKey: null | string;
  readonly to: string;
}

/**
 * Intercepts one delivery attempt and hands its recipient and idempotency key to `onCapture` — the
 * shared shape every send procedure's delivery test asserts on.
 */
function buildDeliveryCaptureHandler(onCapture: (delivery: CapturedDelivery) => void) {
  return http.post(RESEND_ENDPOINT_URL, async (info) => {
    const requestBody = await info.request.json();

    const body = SentEmailBodySchema.parse(requestBody);

    onCapture({
      idempotencyKey: info.request.headers.get('Idempotency-Key'),
      to: body.to,
    });

    return HttpResponse.json({ id: 'mock-email-id' });
  });
}

/**
 * A send procedure nudges its own background drain, so a test's explicit drain races it — either
 * one may deliver the job. Polls until the capture lands instead of trusting one drain to have
 * won.
 */
async function waitForDelivery(
  findCaptured: () => CapturedDelivery | undefined,
): Promise<CapturedDelivery> {
  const deadline = Date.now() + 5000;

  for (;;) {
    const delivery = findCaptured();

    if (delivery !== undefined) {
      return delivery;
    }

    if (Date.now() >= deadline) {
      throw new Error('no delivery captured within 5s');
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
  }
}

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

  let captured: CapturedDelivery | undefined;

  server.use(
    buildDeliveryCaptureHandler((delivery) => {
      captured = delivery;
    }),
  );

  const result = await ctx.client.sendWelcome({
    to: 'player@example.com',
    verificationCode: '123456',
    verificationURL: 'https://versidle.com/verify',
  });

  await ctx.queue.drain('send-welcome');

  const delivery = await waitForDelivery(() => captured);

  expect(delivery).toStrictEqual({ idempotencyKey: result.jobID, to: 'player@example.com' });
});

test('#sendWelcome it rejects invalid input', async () => {
  await using ctx = await setupTest();

  // @ts-expect-error -- exercising the runtime rejection of input the type system would reject too
  const sent = ctx.client.sendWelcome({ to: 'not-an-email', verificationCode: '123456' });

  expect(sent).rejects.toMatchObject({ code: 'BAD_REQUEST' });
});

test('#sendExistingAccount it enqueues and delivers with the tried-to-signup address as a prop', async () => {
  await using ctx = await setupTest();

  let captured: CapturedDelivery | undefined;

  server.use(
    buildDeliveryCaptureHandler((delivery) => {
      captured = delivery;
    }),
  );

  const result = await ctx.client.sendExistingAccount({
    email: 'existing@example.com',
    to: 'existing@example.com',
  });

  await ctx.queue.drain('send-existing-account');

  const delivery = await waitForDelivery(() => captured);

  expect(delivery).toStrictEqual({ idempotencyKey: result.jobID, to: 'existing@example.com' });
});

test('#sendChangeEmailVerification it enqueues and delivers to the account s current address', async () => {
  await using ctx = await setupTest();

  let captured: CapturedDelivery | undefined;

  server.use(
    buildDeliveryCaptureHandler((delivery) => {
      captured = delivery;
    }),
  );

  const result = await ctx.client.sendChangeEmailVerification({
    newEmail: 'new@example.com',
    to: 'old@example.com',
    verificationCode: '123456',
    verificationURL: 'https://versidle.com/verify-email',
  });

  await ctx.queue.drain('send-change-email-verification');

  const delivery = await waitForDelivery(() => captured);

  expect(delivery).toStrictEqual({ idempotencyKey: result.jobID, to: 'old@example.com' });
});

test('#sendChangeEmailNotification it enqueues and delivers with no props beyond the recipient', async () => {
  await using ctx = await setupTest();

  let captured: CapturedDelivery | undefined;

  server.use(
    buildDeliveryCaptureHandler((delivery) => {
      captured = delivery;
    }),
  );

  const result = await ctx.client.sendChangeEmailNotification({ to: 'player@example.com' });

  await ctx.queue.drain('send-change-email-notification');

  const delivery = await waitForDelivery(() => captured);

  expect(delivery).toStrictEqual({ idempotencyKey: result.jobID, to: 'player@example.com' });
});

test('#sendResetPassword it enqueues and delivers', async () => {
  await using ctx = await setupTest();

  let captured: CapturedDelivery | undefined;

  server.use(
    buildDeliveryCaptureHandler((delivery) => {
      captured = delivery;
    }),
  );

  const result = await ctx.client.sendResetPassword({
    resetURL: 'https://versidle.com/reset-password',
    to: 'player@example.com',
  });

  await ctx.queue.drain('send-reset-password');

  const delivery = await waitForDelivery(() => captured);

  expect(delivery).toStrictEqual({ idempotencyKey: result.jobID, to: 'player@example.com' });
});

test('#sendPasswordChanged it enqueues and delivers', async () => {
  await using ctx = await setupTest();

  let captured: CapturedDelivery | undefined;

  server.use(
    buildDeliveryCaptureHandler((delivery) => {
      captured = delivery;
    }),
  );

  const result = await ctx.client.sendPasswordChanged({
    email: 'player@example.com',
    to: 'player@example.com',
  });

  await ctx.queue.drain('send-password-changed');

  const delivery = await waitForDelivery(() => captured);

  expect(delivery).toStrictEqual({ idempotencyKey: result.jobID, to: 'player@example.com' });
});

test('a job left failed by a downstream error survives for a later sweep instead of vanishing', async () => {
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
