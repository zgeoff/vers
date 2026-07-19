import { expect, test } from 'bun:test';
import { createMockSessionData } from './create-mock-session-data';

test('it builds a verified session with the full wire shape by default', () => {
  const session = createMockSessionData();

  expect(session).toStrictEqual({
    createdAt: expect.toBeDate(),
    expiresAt: expect.toBeDate(),
    id: expect.toBeString(),
    ipAddress: expect.toBeString(),
    updatedAt: expect.toBeDate(),
    userID: expect.toBeString(),
    verified: true,
  });
});

test('it applies overrides on top of the defaults', () => {
  const session = createMockSessionData({ id: 'session_1', verified: false });

  expect(session).toStrictEqual({
    createdAt: expect.toBeDate(),
    expiresAt: expect.toBeDate(),
    id: 'session_1',
    ipAddress: expect.toBeString(),
    updatedAt: expect.toBeDate(),
    userID: expect.toBeString(),
    verified: false,
  });
});
