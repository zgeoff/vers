import { expect, test } from 'bun:test';
import { pickSessionBadgeMessage } from './pick-session-badge-message';

test('it reports no active session for an unauthenticated result', () => {
  const message = pickSessionBadgeMessage({ authenticated: false, reason: 'missing-session' });

  expect(message).toBe('Flight fragment: no active session.');
});

test('it names the signed-in user for an authenticated result', () => {
  const message = pickSessionBadgeMessage({
    authenticated: true,
    user: {
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      email: 'pick-session-badge-message@vers.test',
      id: 'user_pick_session_badge_message',
      name: 'Pick Session Badge Message',
      seed: 0,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      username: 'pick-session-badge-message',
    },
  });

  expect(message).toBe('Flight fragment: signed in as Pick Session Badge Message.');
});
