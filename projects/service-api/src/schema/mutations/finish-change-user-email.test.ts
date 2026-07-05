import { afterEach, expect, test } from 'vitest';
import { db } from '../../mocks/db';
import { sentEmails } from '../../mocks/handlers/trpc/service-email/send-email';
import { createMockGQLContext } from '../../test-utils/create-mock-gql-context';
import { SecureAction } from '../../types';
import { createPendingTransaction } from '../../utils/create-pending-transaction';
import { createTransactionToken } from '../../utils/create-transaction-token';
import { resolve } from './finish-change-user-email';

afterEach(() => {
  sentEmails.clear();
});

test('it verifies the transaction token and sends a notification email', async () => {
  const user = db.user.create({
    email: 'old@test.com',
  });

  const session = db.session.create({
    userID: user.id,
  });

  const ctx = createMockGQLContext({ session, user });

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.ChangeEmailConfirmation,
      sessionID: session.id,
      target: 'new@test.com',
    },
    ctx,
  );

  const transactionToken = await createTransactionToken(
    {
      action: SecureAction.ChangeEmailConfirmation,
      ipAddress: ctx.ipAddress,
      sessionID: session.id,
      target: 'new@test.com',
      transactionID,
    },
    ctx,
  );

  const args = {
    input: {
      email: 'new@test.com',
      transactionToken,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({ success: true });

  // check that notification email was sent to the old email
  const emails = sentEmails.get('old@test.com');

  expect(emails?.length).toBe(1);
  expect(emails?.[0]?.subject).toBe('Your Email Address Has Been Changed');
});

test('it returns an error for an invalid transaction token', async () => {
  const user = db.user.create({
    email: 'old@test.com',
  });

  const session = db.session.create({
    userID: user.id,
  });

  const ctx = createMockGQLContext({ session, user });

  const args = {
    input: {
      email: 'new@test.com',
      transactionToken: 'invalid_token',
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    error: {
      message: 'An unknown error occurred',
      title: 'Unknown error occurred',
    },
  });

  const emails = sentEmails.get('old@test.com');

  expect(emails).toBeUndefined();
});
