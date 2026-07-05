import { drop } from '@mswjs/data';
import { afterEach, expect, test } from 'vitest';
import { db } from '../../mocks/db';
import { sentEmails } from '../../mocks/handlers/trpc/service-email/send-email';
import { createMockGQLContext } from '../../test-utils/create-mock-gql-context';
import { resolve } from './start-email-sign-up';

afterEach(() => {
  sentEmails.clear();

  drop(db);
});

test('it creates a verification code and sends an email to the user', async () => {
  const ctx = createMockGQLContext({});

  const args = {
    input: {
      email: 'user@test.com',
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    transactionID: expect.any(String),
  });

  const verification = db.verification.findFirst({
    where: {
      target: { equals: 'user@test.com' },
      type: { equals: 'onboarding' },
    },
  });

  expect(verification).not.toBeNull();

  const emails = sentEmails.get('user@test.com');

  expect(emails?.length).toBe(1);
  expect(emails?.[0]?.html).toContain('http://localhost:4000/verify-otp');
});

test('it notifies an existing user that they have an account and returns success', async () => {
  db.user.create({
    email: 'user@test.com',
    name: 'Test User',
    username: 'test_user',
  });

  const ctx = createMockGQLContext({});

  const args = {
    input: {
      email: 'user@test.com',
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    transactionID: expect.any(String),
  });

  const emails = sentEmails.get('user@test.com');

  expect(emails?.length).toBe(1);
  expect(emails?.[0]?.subject).toContain('You already have an account!');
});
