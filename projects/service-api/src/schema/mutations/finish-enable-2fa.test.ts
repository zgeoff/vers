import { drop } from '@mswjs/data';
import invariant from 'tiny-invariant';
import { afterEach, expect, test } from 'vitest';
import { db } from '../../mocks/db';
import { createMockGQLContext } from '../../test-utils/create-mock-gql-context';
import { SecureAction } from '../../types';
import { createPendingTransaction } from '../../utils/create-pending-transaction';
import { createTransactionToken } from '../../utils/create-transaction-token';
import { resolve } from './finish-enable-2fa';

afterEach(() => {
  drop(db);
});

test('it successfully completes 2FA setup', async () => {
  const user = db.user.create({
    email: 'test@example.com',
  });

  const verification = db.verification.create({
    target: user.email,
    type: '2fa-setup',
  });

  const ctx = createMockGQLContext({ user });

  invariant(ctx.session, 'session is required');

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.TwoFactorAuthSetup,
      sessionID: ctx.session.id,
      target: user.email,
    },
    ctx,
  );

  const transactionToken = await createTransactionToken(
    {
      action: SecureAction.TwoFactorAuthSetup,
      ipAddress: ctx.ipAddress,
      sessionID: ctx.session.id,
      target: user.email,
      transactionID,
    },
    ctx,
  );

  const args = {
    input: {
      transactionToken,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({ success: true });

  // Verify that the verification record was updated
  const updatedVerification = db.verification.findFirst({
    where: {
      id: { equals: verification.id },
    },
  });

  expect(updatedVerification).toMatchObject({
    algorithm: 'SHA-256',
    charSet: 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789',
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    createdAt: expect.any(Date),
    digits: 6,
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    expiresAt: expect.any(Date),
    id: verification.id,
    period: 300,
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    secret: expect.any(String),
    target: user.email,
    type: '2fa',
  });
});

test('it returns an error if the transaction token is invalid', async () => {
  const user = db.user.create({
    email: 'test@example.com',
  });

  db.verification.create({
    target: user.email,
    type: '2fa-setup',
  });

  const ctx = createMockGQLContext({ user });

  const args = {
    input: {
      transactionToken: 'test-transaction-token',
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    error: {
      message: 'An unknown error occurred',
      title: 'Unknown error occurred',
    },
  });
});

test('it returns an error if there is no 2FA verification record', async () => {
  const user = db.user.create({
    email: 'test@example.com',
  });

  const ctx = createMockGQLContext({ user });

  invariant(ctx.session, 'session is required');

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.TwoFactorAuthSetup,
      sessionID: ctx.session.id,
      target: user.email,
    },
    ctx,
  );

  const transactionToken = await createTransactionToken(
    {
      action: SecureAction.TwoFactorAuthSetup,
      ipAddress: ctx.ipAddress,
      sessionID: ctx.session.id,
      target: user.email,
      transactionID,
    },
    ctx,
  );

  const args = {
    input: {
      transactionToken,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    error: {
      message: 'An unknown error occurred',
      title: 'Unknown error occurred',
    },
  });
});

test('it returns an error if unauthorized', async () => {
  const ctx = createMockGQLContext({});

  const args = {
    input: {
      transactionToken: 'test-transaction-token',
    },
  };

  await expect(resolve({}, args, ctx)).rejects.toThrow('Unauthorized');
});
