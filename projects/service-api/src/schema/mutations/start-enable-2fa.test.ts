import { drop } from '@mswjs/data';
import invariant from 'tiny-invariant';
import { afterEach, expect, test } from 'vitest';
import { db } from '../../mocks/db';
import { createMockGQLContext } from '../../test-utils/create-mock-gql-context';
import { SecureAction } from '../../types';
import { pendingTransactionCache } from '../../utils/pending-transaction-cache';
import { resolve } from './start-enable-2fa';

afterEach(() => {
  drop(db);
});

test('it creates a verification record for 2FA setup with a pending transaction', async () => {
  const user = db.user.create({
    email: 'test@example.com',
  });

  const ctx = createMockGQLContext({ user });

  const result = await resolve({}, {}, ctx);

  expect(result).toStrictEqual({
    transactionID: expect.any(String),
  });

  const verification = db.verification.findFirst({
    where: {
      target: { equals: user.email },
      type: {
        equals: '2fa-setup',
      },
    },
  });

  expect(verification).toMatchObject({
    algorithm: 'SHA-256',
    charSet: 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789',
    createdAt: expect.any(Date),
    digits: 6,
    expiresAt: null,
    id: expect.any(String),
    period: 300,
    secret: expect.any(String),
    target: user.email,
    type: '2fa-setup',
  });

  invariant('transactionID' in result);

  const pendingTransaction = pendingTransactionCache.get(result.transactionID);

  expect(pendingTransaction).toStrictEqual({
    action: SecureAction.TwoFactorAuthSetup,
    attempts: 0,
    ipAddress: ctx.ipAddress,
    sessionID: ctx.session?.id,
    target: user.email,
  });
});

test('it returns an error if 2FA is already enabled', async () => {
  const user = db.user.create({
    email: 'test@example.com',
  });

  db.verification.create({
    target: user.email,
    type: '2fa',
  });

  const ctx = createMockGQLContext({ user });

  const result = await resolve({}, {}, ctx);

  expect(result).toStrictEqual({
    error: {
      message: '2FA is already enabled for your account.',
      title: '2FA already enabled',
    },
  });
});

test('it replaces an existing 2FA setup verification record', async () => {
  const user = db.user.create({
    email: 'test@example.com',
  });

  const firstVerification = db.verification.create({
    target: user.email,
    type: '2fa-setup',
  });

  const ctx = createMockGQLContext({ user });

  const result = await resolve({}, {}, ctx);

  expect(result).toStrictEqual({
    transactionID: expect.any(String),
  });

  const verifications = db.verification.findMany({
    where: {
      target: { equals: user.email },
      type: {
        equals: '2fa-setup',
      },
    },
  });

  expect(verifications).toHaveLength(1);
  expect(verifications[0]?.id).not.toBe(firstVerification.id);
});

test('it returns an error if the user isnt authenticated', async () => {
  const ctx = createMockGQLContext({});

  await expect(() => resolve({}, {}, ctx)).rejects.toThrow('Unauthorized');
});
