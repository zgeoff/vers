import { expect, test } from 'bun:test';
import { call } from '@orpc/server';
import { deriveScopeSecret } from './derive-scope-secret';

test('it derives a 64-char lowercase hex secret', async () => {
  const result = await call(
    deriveScopeSecret,
    { avatarID: 'avatar-1', secretRef: 'worldmap', secretVersion: 1 },
    { context: { actingUserID: null } },
  );

  expect(result.secret).toMatch(/^[0-9a-f]{64}$/);
});

test('it derives the same secret for the same input across calls', async () => {
  const input = { avatarID: 'avatar-1', secretRef: 'worldmap', secretVersion: 1 } as const;

  const first = await call(deriveScopeSecret, input, { context: { actingUserID: null } });
  const second = await call(deriveScopeSecret, input, { context: { actingUserID: null } });

  expect(first).toStrictEqual(second);
});

test('it derives distinct secrets per avatar and secret version', async () => {
  const base = { avatarID: 'avatar-1', secretRef: 'worldmap', secretVersion: 1 } as const;

  const secrets = await Promise.all([
    call(deriveScopeSecret, base, { context: { actingUserID: null } }),
    call(deriveScopeSecret, { ...base, avatarID: 'avatar-2' }, { context: { actingUserID: null } }),
    call(deriveScopeSecret, { ...base, secretVersion: 2 }, { context: { actingUserID: null } }),
  ]);

  const distinct = new Set(secrets.map((result) => result.secret));

  expect(distinct.size).toBe(3);
});
