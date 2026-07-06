import { expect, test } from 'bun:test';
import { SessionDataSchema } from './session-data-schema';

test('it accepts a well-formed session', () => {
  const result = SessionDataSchema.safeParse({
    createdAt: new Date(),
    expiresAt: new Date(),
    id: 'session_1',
    ipAddress: '127.0.0.1',
    updatedAt: new Date(),
    userID: 'user_1',
    verified: true,
  });

  expect(result.success).toBeTrue();
});

test('it rejects a session missing required fields', () => {
  expect(SessionDataSchema.safeParse({ id: 'session_1' }).success).toBeFalse();
});
