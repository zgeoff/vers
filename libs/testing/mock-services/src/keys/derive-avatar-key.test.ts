import { expect, test } from 'bun:test';
import { call } from '@orpc/server';
import { deriveAvatarKey } from './derive-avatar-key';

test('it derives a 64-char lowercase hex key', async () => {
  const result = await call(
    deriveAvatarKey,
    { avatarID: 'avatar-1', keyVersion: 1, population: 'trade' },
    { context: { actingUserId: null } },
  );

  expect(result.key).toMatch(/^[0-9a-f]{64}$/);
});

test('it derives the same key for the same input across calls', async () => {
  const input = { avatarID: 'avatar-1', keyVersion: 1, population: 'trade' } as const;

  const first = await call(deriveAvatarKey, input, { context: { actingUserId: null } });
  const second = await call(deriveAvatarKey, input, { context: { actingUserId: null } });

  expect(first).toStrictEqual(second);
});

test('it derives distinct keys per avatar, population, and key version', async () => {
  const base = { avatarID: 'avatar-1', keyVersion: 1, population: 'trade' } as const;

  const keys = await Promise.all([
    call(deriveAvatarKey, base, { context: { actingUserId: null } }),
    call(deriveAvatarKey, { ...base, avatarID: 'avatar-2' }, { context: { actingUserId: null } }),
    call(deriveAvatarKey, { ...base, keyVersion: 2 }, { context: { actingUserId: null } }),
    call(
      deriveAvatarKey,
      { ...base, population: 'self-found' },
      { context: { actingUserId: null } },
    ),
  ]);

  const distinct = new Set(keys.map((result) => result.key));

  expect(distinct.size).toBe(4);
});
