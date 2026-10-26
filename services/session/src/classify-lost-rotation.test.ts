import { expect, test } from 'bun:test';
import { classifyLostRotation } from './classify-lost-rotation';

test('it revokes a session that is gone after a lost rotation', () => {
  expect(
    classifyLostRotation(undefined, 'presented-token', new Date('2026-03-10T12:00:00Z')),
  ).toStrictEqual({ kind: 'reuse' });
});

test.each([
  [
    'a token two rotations old',
    {
      createdAt: new Date('2026-03-01T12:00:00Z'),
      expiresAt: new Date('2026-03-17T12:00:00Z'),
      previousRefreshToken: 'second-token',
      refreshToken: 'third-token',
      rotationGraceUntil: new Date('2026-03-10T12:00:30Z'),
      userId: 'user-a',
    },
    { kind: 'reuse' },
  ],
  [
    'the previous token inside the grace window',
    {
      createdAt: new Date('2026-03-01T12:00:00Z'),
      expiresAt: new Date('2026-03-17T12:00:00Z'),
      previousRefreshToken: 'presented-token',
      refreshToken: 'second-token',
      rotationGraceUntil: new Date('2026-03-10T12:00:30Z'),
      userId: 'user-a',
    },
    { kind: 'grace', refreshToken: 'second-token', userID: 'user-a' },
  ],
  [
    'the previous token after the grace window',
    {
      createdAt: new Date('2026-03-01T12:00:00Z'),
      expiresAt: new Date('2026-03-17T12:00:00Z'),
      previousRefreshToken: 'presented-token',
      refreshToken: 'second-token',
      rotationGraceUntil: new Date('2026-03-10T11:59:30Z'),
      userId: 'user-a',
    },
    { kind: 'reuse' },
  ],
  [
    'a session that expired during the race',
    {
      createdAt: new Date('2026-03-01T12:00:00Z'),
      expiresAt: new Date('2026-03-10T11:59:59Z'),
      previousRefreshToken: 'presented-token',
      refreshToken: 'second-token',
      rotationGraceUntil: new Date('2026-03-10T12:00:30Z'),
      userId: 'user-a',
    },
    { kind: 'expired' },
  ],
] as const)('it classifies %s after a lost rotation', (_label, row, expected) => {
  expect(
    classifyLostRotation(row, 'presented-token', new Date('2026-03-10T12:00:00Z')),
  ).toStrictEqual(expected);
});

test('it refuses a lost rotation that leaves the presented token current', () => {
  expect(() =>
    classifyLostRotation(
      {
        createdAt: new Date('2026-03-01T12:00:00Z'),
        expiresAt: new Date('2026-03-17T12:00:00Z'),
        previousRefreshToken: null,
        refreshToken: 'presented-token',
        rotationGraceUntil: null,
        userId: 'user-a',
      },
      'presented-token',
      new Date('2026-03-10T12:00:00Z'),
    ),
  ).toThrowWithMessage(Error, /no longer current/u);
});
