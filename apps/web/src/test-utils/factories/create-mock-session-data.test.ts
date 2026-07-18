import { expect, test } from 'bun:test';
import { createMockSessionData } from './create-mock-session-data';

test('it builds a verified session with the full wire shape by default', () => {
  const session = createMockSessionData();

  expect(session).toContainAllKeys([
    'createdAt',
    'expiresAt',
    'id',
    'ipAddress',
    'updatedAt',
    'userID',
    'verified',
  ]);

  expect(session.createdAt).toBeValidDate();
  expect(session.expiresAt).toBeValidDate();
  expect(session.verified).toBe(true);
});

test('it applies overrides over the defaults', () => {
  const session = createMockSessionData({ id: 'session_1', verified: false });

  expect(session.id).toBe('session_1');
  expect(session.verified).toBe(false);
});
