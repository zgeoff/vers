import { generateTOTP } from '@epic-web/totp';
import { drop } from '@mswjs/data';
import invariant from 'tiny-invariant';
import { afterEach, expect, test } from 'vitest';
import { db } from '../../mocks/db';
import { createMockGQLContext } from '../../test-utils/create-mock-gql-context';
import { SecureAction } from '../../types';
import { createPendingTransaction } from '../../utils/create-pending-transaction';
import { verifyTransactionToken } from '../../utils/verify-transaction-token';
import { VerificationType } from '../types/verification-type';
import { resolve } from './verify-otp';

afterEach(() => {
  drop(db);
});

test('it verifies a valid onboarding otp and returns a valid transaction token', async () => {
  const ctx = createMockGQLContext({});

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.Onboarding,
      sessionID: null,
      target: 'test@example.com',
    },
    ctx,
  );

  const { otp, ...verificationConfig } = await generateTOTP({
    algorithm: 'SHA-256',
    charSet: 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789',
  });

  db.verification.create({
    target: 'test@example.com',
    type: 'onboarding',
    ...verificationConfig,
  });

  const args = {
    input: {
      code: otp,
      sessionID: null,
      target: 'test@example.com',
      transactionID,
      type: VerificationType.ONBOARDING,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    transactionToken: expect.any(String),
  });

  invariant('transactionToken' in result);

  const isValid = await verifyTransactionToken(
    {
      action: SecureAction.Onboarding,
      target: 'test@example.com',
      token: result.transactionToken,
    },
    ctx,
  );

  expect(isValid).toStrictEqual({
    action: SecureAction.Onboarding,
    amr: ['otp'],
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    auth_time: expect.any(Number),
    ip_address: ctx.ipAddress,
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    jti: expect.any(String),
    mfa_verified: true,
    session_id: null,
    sub: 'test@example.com',
    transaction_id: transactionID,
  });
});

test('it verifies a valid change email otp and returns a valid transaction token', async () => {
  const session = db.session.create();

  const ctx = createMockGQLContext({ session });

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.ChangeEmail,
      sessionID: session.id,
      target: 'test@example.com',
    },
    ctx,
  );

  const { otp, ...verificationConfig } = await generateTOTP({
    algorithm: 'SHA-256',
    charSet: 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789',
  });

  db.verification.create({
    target: 'test@example.com',
    type: '2fa',
    ...verificationConfig,
  });

  const args = {
    input: {
      code: otp,
      sessionID: session.id,
      target: 'test@example.com',
      transactionID,
      type: VerificationType.CHANGE_EMAIL,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    transactionToken: expect.any(String),
  });

  invariant('transactionToken' in result);

  const isValid = await verifyTransactionToken(
    {
      action: SecureAction.ChangeEmail,
      target: 'test@example.com',
      token: result.transactionToken,
    },
    ctx,
  );

  expect(isValid).toStrictEqual({
    action: SecureAction.ChangeEmail,
    amr: ['otp'],
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    auth_time: expect.any(Number),
    ip_address: ctx.ipAddress,
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    jti: expect.any(String),
    mfa_verified: true,
    session_id: session.id,
    sub: 'test@example.com',
    transaction_id: transactionID,
  });
});

test('it verifies a valid change password otp and returns a valid transaction token', async () => {
  const session = db.session.create();

  const ctx = createMockGQLContext({ session });

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.ChangePassword,
      sessionID: session.id,
      target: 'test@example.com',
    },
    ctx,
  );

  const { otp, ...verificationConfig } = await generateTOTP({
    algorithm: 'SHA-256',
    charSet: 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789',
  });

  db.verification.create({
    target: 'test@example.com',
    type: '2fa',
    ...verificationConfig,
  });

  const args = {
    input: {
      code: otp,
      sessionID: session.id,
      target: 'test@example.com',
      transactionID,
      type: VerificationType.CHANGE_PASSWORD,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    transactionToken: expect.any(String),
  });

  invariant('transactionToken' in result);

  const isValid = await verifyTransactionToken(
    {
      action: SecureAction.ChangePassword,
      target: 'test@example.com',
      token: result.transactionToken,
    },
    ctx,
  );

  expect(isValid).toStrictEqual({
    action: SecureAction.ChangePassword,
    amr: ['otp'],
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    auth_time: expect.any(Number),
    ip_address: ctx.ipAddress,
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    jti: expect.any(String),
    mfa_verified: true,
    session_id: session.id,
    sub: 'test@example.com',
    transaction_id: transactionID,
  });
});

test('it verifies a valid reset password otp and returns a valid transaction token', async () => {
  const ctx = createMockGQLContext({});

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.ResetPassword,
      sessionID: null,
      target: 'test@example.com',
    },
    ctx,
  );

  const { otp, ...verificationConfig } = await generateTOTP({
    algorithm: 'SHA-256',
    charSet: 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789',
  });

  db.verification.create({
    target: 'test@example.com',
    type: '2fa',
    ...verificationConfig,
  });

  const args = {
    input: {
      code: otp,
      target: 'test@example.com',
      transactionID,
      type: VerificationType.RESET_PASSWORD,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    transactionToken: expect.any(String),
  });

  invariant('transactionToken' in result);

  const isValid = await verifyTransactionToken(
    {
      action: SecureAction.ResetPassword,
      target: 'test@example.com',
      token: result.transactionToken,
    },
    ctx,
  );

  expect(isValid).toStrictEqual({
    action: SecureAction.ResetPassword,
    amr: ['otp'],
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    auth_time: expect.any(Number),
    ip_address: ctx.ipAddress,
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    jti: expect.any(String),
    mfa_verified: true,
    session_id: null,
    sub: 'test@example.com',
    transaction_id: transactionID,
  });
});

test('it verifies a valid change email confirmation otp and returns a valid transaction token', async () => {
  const user = db.user.create();
  const session = db.session.create({ userID: user.id });

  const ctx = createMockGQLContext({ session });

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.ChangeEmailConfirmation,
      sessionID: session.id,
      target: 'test@example.com',
    },
    ctx,
  );

  const { otp, ...verificationConfig } = await generateTOTP({
    algorithm: 'SHA-256',
    charSet: 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789',
  });

  db.verification.create({
    target: 'test@example.com',
    type: 'change-email',
    ...verificationConfig,
  });

  const args = {
    input: {
      code: otp,
      sessionID: session.id,
      target: 'test@example.com',
      transactionID,
      type: VerificationType.CHANGE_EMAIL_CONFIRMATION,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    transactionToken: expect.any(String),
  });

  invariant('transactionToken' in result);

  const isValid = await verifyTransactionToken(
    {
      action: SecureAction.ChangeEmailConfirmation,
      target: 'test@example.com',
      token: result.transactionToken,
    },
    ctx,
  );

  expect(isValid).toStrictEqual({
    action: SecureAction.ChangeEmailConfirmation,
    amr: ['otp'],
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    auth_time: expect.any(Number),
    ip_address: ctx.ipAddress,
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    jti: expect.any(String),
    mfa_verified: true,
    session_id: session.id,
    sub: 'test@example.com',
    transaction_id: transactionID,
  });
});

test('it throws an error if session validation fails', async () => {
  const ctx = createMockGQLContext({});

  const session = db.session.create({
    ipAddress: ctx.ipAddress,
  });

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.TwoFactorAuth,
      sessionID: session.id,
      target: 'test@example.com',
    },
    ctx,
  );

  const { otp, ...verificationConfig } = await generateTOTP({
    algorithm: 'SHA-256',
    charSet: 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789',
  });

  db.verification.create({
    target: 'test@example.com',
    type: '2fa',
    ...verificationConfig,
  });

  const args = {
    input: {
      code: otp,
      sessionID: 'non_existent_session',
      target: 'test@example.com',
      transactionID,
      type: VerificationType.TWO_FACTOR_AUTH,
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

test('it returns an error for an invalid OTP', async () => {
  const ctx = createMockGQLContext({});

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.Onboarding,
      sessionID: null,
      target: 'test@example.com',
    },
    ctx,
  );

  const { otp, ...verificationConfig } = await generateTOTP({
    algorithm: 'SHA-256',
    charSet: 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789',
  });

  db.verification.create({
    target: 'test@example.com',
    type: '2fa',
    ...verificationConfig,
  });

  const args = {
    input: {
      code: 'invalid',
      target: 'test@example.com',
      transactionID,
      type: VerificationType.ONBOARDING,
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

test('it returns an error if verification does not exist', async () => {
  const ctx = createMockGQLContext({});

  const transactionID = createPendingTransaction(
    {
      action: SecureAction.Onboarding,
      sessionID: null,
      target: 'nonexistent@example.com',
    },
    ctx,
  );

  const args = {
    input: {
      code: '999123',
      target: 'nonexistent@example.com',
      transactionID,
      type: VerificationType.ONBOARDING,
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
