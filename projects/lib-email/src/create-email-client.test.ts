import { HttpResponse, http } from 'msw';
import { expect, test } from 'vitest';
import { createEmailClient } from './create-email-client';
import { ENDPOINT_URL as RESEND_EMAIL_ENDPOINT_URL } from './mocks/handlers/http/resend-emails';
import { server } from './mocks/node';

test('it sends an email with the default from address', async () => {
  let capturedBody: unknown;

  server.use(
    http.post(RESEND_EMAIL_ENDPOINT_URL, async (info) => {
      capturedBody = await info.request.json();

      return HttpResponse.json({ id: 'mock-email-id' });
    }),
  );

  const client = createEmailClient({ apiKey: 'test-api-key' });

  const result = await client.sendEmail({
    html: '<p>Test content</p>',
    plainText: 'Test content',
    subject: 'Test Subject',
    to: 'test@example.com',
  });

  expect(result).toStrictEqual({ id: 'mock-email-id' });

  expect(capturedBody).toStrictEqual({
    from: 'noreply@transactional.versidle.com',
    html: '<p>Test content</p>',
    subject: 'Test Subject',
    text: 'Test content',
    to: 'test@example.com',
  });
});

test('it sends an email from a configured from address override', async () => {
  let capturedBody: unknown;

  server.use(
    http.post(RESEND_EMAIL_ENDPOINT_URL, async (info) => {
      capturedBody = await info.request.json();

      return HttpResponse.json({ id: 'mock-email-id' });
    }),
  );

  const client = createEmailClient({ apiKey: 'test-api-key', from: 'hello@example.com' });

  await client.sendEmail({
    html: '<p>Test content</p>',
    plainText: 'Test content',
    subject: 'Test Subject',
    to: 'test@example.com',
  });

  expect(capturedBody).toMatchObject({ from: 'hello@example.com' });
});

test('it throws when resend reports an error', async () => {
  server.use(http.post(RESEND_EMAIL_ENDPOINT_URL, () => HttpResponse.error()));

  const client = createEmailClient({ apiKey: 'test-api-key' });

  await expect(
    client.sendEmail({
      html: '<p>Test content</p>',
      plainText: 'Test content',
      subject: 'Test Subject',
      to: 'test@example.com',
    }),
  ).rejects.toThrowWithMessage(Error, /failed to send email/);
});
