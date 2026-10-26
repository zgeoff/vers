import { expect, test } from 'bun:test';
import { classifyRefresh } from './classify-refresh';

test('it classifies a session that does not exist as missing', () => {
  expect(classifyRefresh(undefined, 'any-token', new Date('2026-03-10T12:00:00Z'))).toStrictEqual({
    kind: 'missing',
  });
});

test.each([
  [
    'an expired session, whatever the token',
    {
      createdAt: new Date('2026-03-01T12:00:00Z'),
      expiresAt: new Date('2026-03-10T11:59:59Z'),
      previousRefreshToken: null,
      refreshToken: 'current-token',
      rotationGraceUntil: null,
      userId: 'user-a',
    },
    'current-token',
    { kind: 'expired' },
  ],
  [
    'an expired session presented with its previous token inside the grace window',
    {
      createdAt: new Date('2026-03-01T12:00:00Z'),
      expiresAt: new Date('2026-03-10T11:59:59Z'),
      previousRefreshToken: 'previous-token',
      refreshToken: 'current-token',
      rotationGraceUntil: new Date('2026-03-10T12:00:30Z'),
      userId: 'user-a',
    },
    'previous-token',
    { kind: 'expired' },
  ],
  [
    'the previous token inside the grace window',
    {
      createdAt: new Date('2026-03-01T12:00:00Z'),
      expiresAt: new Date('2026-03-17T12:00:00Z'),
      previousRefreshToken: 'previous-token',
      refreshToken: 'current-token',
      rotationGraceUntil: new Date('2026-03-10T12:00:30Z'),
      userId: 'user-a',
    },
    'previous-token',
    { kind: 'grace', refreshToken: 'current-token', userID: 'user-a' },
  ],
  [
    'the previous token at the end of the grace window',
    {
      createdAt: new Date('2026-03-01T12:00:00Z'),
      expiresAt: new Date('2026-03-17T12:00:00Z'),
      previousRefreshToken: 'previous-token',
      refreshToken: 'current-token',
      rotationGraceUntil: new Date('2026-03-10T12:00:00Z'),
      userId: 'user-a',
    },
    'previous-token',
    { kind: 'reuse' },
  ],
  [
    'the previous token with no grace window recorded',
    {
      createdAt: new Date('2026-03-01T12:00:00Z'),
      expiresAt: new Date('2026-03-17T12:00:00Z'),
      previousRefreshToken: 'previous-token',
      refreshToken: 'current-token',
      rotationGraceUntil: null,
      userId: 'user-a',
    },
    'previous-token',
    { kind: 'reuse' },
  ],
  [
    'the previous token of a session with no current token',
    {
      createdAt: new Date('2026-03-01T12:00:00Z'),
      expiresAt: new Date('2026-03-17T12:00:00Z'),
      previousRefreshToken: 'previous-token',
      refreshToken: null,
      rotationGraceUntil: new Date('2026-03-10T12:00:30Z'),
      userId: 'user-a',
    },
    'previous-token',
    { kind: 'reuse' },
  ],
  [
    'a token that matches neither stored token',
    {
      createdAt: new Date('2026-03-01T12:00:00Z'),
      expiresAt: new Date('2026-03-17T12:00:00Z'),
      previousRefreshToken: 'previous-token',
      refreshToken: 'current-token',
      rotationGraceUntil: new Date('2026-03-10T12:00:30Z'),
      userId: 'user-a',
    },
    'older-token',
    { kind: 'mismatch' },
  ],
  [
    'any token for a session with no current token',
    {
      createdAt: new Date('2026-03-01T12:00:00Z'),
      expiresAt: new Date('2026-03-17T12:00:00Z'),
      previousRefreshToken: null,
      refreshToken: null,
      rotationGraceUntil: null,
      userId: 'user-a',
    },
    'current-token',
    { kind: 'mismatch' },
  ],
  [
    'the current token of a session younger than a day',
    {
      createdAt: new Date('2026-03-10T00:00:00Z'),
      expiresAt: new Date('2026-03-17T12:00:00Z'),
      previousRefreshToken: null,
      refreshToken: 'current-token',
      rotationGraceUntil: null,
      userId: 'user-a',
    },
    'current-token',
    { kind: 'renew', refreshToken: 'current-token', userID: 'user-a' },
  ],
  [
    'the current token of a session a day old',
    {
      createdAt: new Date('2026-03-09T12:00:00Z'),
      expiresAt: new Date('2026-03-17T12:00:00Z'),
      previousRefreshToken: 'previous-token',
      refreshToken: 'current-token',
      rotationGraceUntil: null,
      userId: 'user-a',
    },
    'current-token',
    {
      expiresAt: new Date('2026-03-17T12:00:00Z'),
      kind: 'rotate',
      refreshToken: 'current-token',
      userID: 'user-a',
    },
  ],
] as const)('it classifies %s', (_label, row, token, expected) => {
  expect(classifyRefresh(row, token, new Date('2026-03-10T12:00:00Z'))).toStrictEqual(expected);
});
