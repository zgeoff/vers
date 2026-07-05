import { HttpResponse, http } from 'msw';
import { afterEach, expect, test } from 'vitest';
import { ENDPOINT_URL as RESEND_EMAIL_ENDPOINT_URL } from '../mocks/handlers/http/resend-emails';
import { server } from '../mocks/node';
import { router } from '../router';
import { t } from '../t';

const createCaller = t.createCallerFactory(router);

function setupTest() {
  const caller = createCaller({});

  return { caller };
}

afterEach(() => {
  server.resetHandlers();
});

test('it successfully sends an email', async () => {
  const { caller } = setupTest();

  const email = {
    html: '<p>Test content</p>',
    plainText: 'Test content',
    subject: 'Test Subject',
    to: 'test@example.com',
  };

  const result = await caller.sendEmail(email);

  expect(result).toStrictEqual({});
});

test('it throws an error for Resend errors', async () => {
  server.use(http.post(RESEND_EMAIL_ENDPOINT_URL, () => HttpResponse.error()));

  const { caller } = setupTest();

  const email = {
    html: '<p>Test content</p>',
    plainText: 'Test content',
    subject: 'Test Subject',
    to: 'test@example.com',
  };

  await expect(caller.sendEmail(email)).rejects.toMatchObject({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Failed to send email',
  });
});
