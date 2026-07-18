import { expect, onTestFinished, test } from 'bun:test';
import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import {
  InMemorySpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { HttpResponse, http } from 'msw';
import { createEmailClient } from './create-email-client';
import { RESEND_ENDPOINT_URL, sentEmails, server } from './mocks/node';

function setupSpanCapture() {
  const exporter = new InMemorySpanExporter();
  const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });

  provider.register();

  onTestFinished(async () => {
    trace.disable();

    await provider.shutdown();
  });

  return { exporter };
}

test('it sends an email with the default from address', async () => {
  const client = createEmailClient({ apiKey: 'test-api-key' });

  const result = await client.sendEmail({
    html: '<p>Test content</p>',
    plainText: 'Test content',
    subject: 'Test Subject',
    to: 'test@example.com',
  });

  expect(result).toStrictEqual({ id: 'mock-email-id' });

  expect(sentEmails.get('test@example.com')).toStrictEqual({
    from: 'noreply@transactional.versidle.com',
    html: '<p>Test content</p>',
    idempotencyKey: null,
    plainText: 'Test content',
    subject: 'Test Subject',
    to: 'test@example.com',
  });
});

test('it sends an email from a configured from address override', async () => {
  const client = createEmailClient({ apiKey: 'test-api-key', from: 'hello@example.com' });

  await client.sendEmail({
    html: '<p>Test content</p>',
    plainText: 'Test content',
    subject: 'Test Subject',
    to: 'test@example.com',
  });

  expect(sentEmails.get('test@example.com')).toMatchObject({ from: 'hello@example.com' });
});

test('it sends the idempotency key as a header', async () => {
  const client = createEmailClient({ apiKey: 'test-api-key' });

  await client.sendEmail({
    html: '<p>Test content</p>',
    idempotencyKey: 'job-123',
    plainText: 'Test content',
    subject: 'Test Subject',
    to: 'test@example.com',
  });

  expect(sentEmails.get('test@example.com')).toMatchObject({ idempotencyKey: 'job-123' });
});

test('it omits the idempotency key header when none is given', async () => {
  const client = createEmailClient({ apiKey: 'test-api-key' });

  await client.sendEmail({
    html: '<p>Test content</p>',
    plainText: 'Test content',
    subject: 'Test Subject',
    to: 'test@example.com',
  });

  expect(sentEmails.get('test@example.com')).toMatchObject({ idempotencyKey: null });
});

test('it throws when resend reports an error', () => {
  server.use(http.post(RESEND_ENDPOINT_URL, () => HttpResponse.error()));

  const client = createEmailClient({ apiKey: 'test-api-key' });

  expect(
    client.sendEmail({
      html: '<p>Test content</p>',
      plainText: 'Test content',
      subject: 'Test Subject',
      to: 'test@example.com',
    }),
  ).rejects.toThrowWithMessage(Error, /failed to send email/);
});

test('it emits a resend.send client span for a successful send', async () => {
  const ctx = setupSpanCapture();
  const client = createEmailClient({ apiKey: 'test-api-key' });

  await client.sendEmail({
    html: '<p>Test content</p>',
    plainText: 'Test content',
    subject: 'Test Subject',
    to: 'test@example.com',
  });

  const [span] = ctx.exporter.getFinishedSpans();

  expect(span?.name).toBe('resend.send');
  expect(span?.kind).toBe(SpanKind.CLIENT);
  expect(span?.status.code).not.toBe(SpanStatusCode.ERROR);
});

test('it marks the span failed when resend reports an error', async () => {
  const ctx = setupSpanCapture();

  server.use(http.post(RESEND_ENDPOINT_URL, () => HttpResponse.error()));

  const client = createEmailClient({ apiKey: 'test-api-key' });

  const pending = client.sendEmail({
    html: '<p>Test content</p>',
    plainText: 'Test content',
    subject: 'Test Subject',
    to: 'test@example.com',
  });

  expect(pending).rejects.toThrowWithMessage(Error, /failed to send email/);

  await expect(pending).toReject();

  const [span] = ctx.exporter.getFinishedSpans();

  expect(span?.status.code).toBe(SpanStatusCode.ERROR);
});
