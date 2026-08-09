import { expect, test } from 'bun:test';
import { hexToBytes } from '@noble/hashes/utils.js';
import type { KeysContract } from '@vers/contract-keys';
import { deriveAvatarKey, deriveScopeSecret } from '@vers/roll-crypto';
import { createAnonymousViewer } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createKeysService } from './create-keys-service';

const TRADE_ROOT_HEX = '11'.repeat(32);
const WORLDMAP_ROOT_HEX = '44'.repeat(32);

async function setupTest() {
  const service = await createKeysService();

  return { app: service.app };
}

test('it derives the same key twice for identical input', async () => {
  const ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-keys' });

  const client = buildRPCTestClient<KeysContract>(ctx.app, { token: viewer.token });
  const input = { avatarID: 'avatar-1', keyVersion: 1, population: 'trade' as const };

  const first = await client.deriveAvatarKey(input);
  const second = await client.deriveAvatarKey(input);

  expect(first).toStrictEqual(second);
});

test('it derives a key matching a direct call against the configured root', async () => {
  const ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-keys' });

  const client = buildRPCTestClient<KeysContract>(ctx.app, { token: viewer.token });

  const result = await client.deriveAvatarKey({
    avatarID: 'avatar-1',
    keyVersion: 1,
    population: 'trade',
  });

  const expected = deriveAvatarKey({
    avatarID: 'avatar-1',
    keyVersion: 1,
    population: 'trade',
    root: hexToBytes(TRADE_ROOT_HEX),
  });

  expect(result.key).toBe(Buffer.from(expected).toString('hex'));
});

test('it derives diverging keys across populations', async () => {
  const ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-keys' });

  const client = buildRPCTestClient<KeysContract>(ctx.app, { token: viewer.token });

  const trade = await client.deriveAvatarKey({
    avatarID: 'avatar-1',
    keyVersion: 1,
    population: 'trade',
  });

  const selfFound = await client.deriveAvatarKey({
    avatarID: 'avatar-1',
    keyVersion: 1,
    population: 'self-found',
  });

  expect(trade.key).not.toBe(selfFound.key);
});

test('it derives diverging keys across key versions', async () => {
  const ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-keys' });

  const client = buildRPCTestClient<KeysContract>(ctx.app, { token: viewer.token });

  const versionOne = await client.deriveAvatarKey({
    avatarID: 'avatar-1',
    keyVersion: 1,
    population: 'trade',
  });

  const versionTwo = await client.deriveAvatarKey({
    avatarID: 'avatar-1',
    keyVersion: 2,
    population: 'trade',
  });

  expect(versionOne.key).not.toBe(versionTwo.key);
});

test('it rejects an unknown key version with NOT_FOUND naming the version and population', async () => {
  const ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-keys' });

  const client = buildRPCTestClient<KeysContract>(ctx.app, { token: viewer.token });

  expect(
    client.deriveAvatarKey({ avatarID: 'avatar-1', keyVersion: 99, population: 'trade' }),
  ).rejects.toMatchObject({
    code: 'NOT_FOUND',
    data: { keyVersion: 99, population: 'trade' },
  });
});

test('it derives a scope secret matching a direct call against the configured root', async () => {
  const ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-keys' });

  const client = buildRPCTestClient<KeysContract>(ctx.app, { token: viewer.token });

  const result = await client.deriveScopeSecret({
    avatarID: 'avatar-1',
    secretRef: 'worldmap',
    secretVersion: 1,
  });

  const expected = deriveScopeSecret({
    avatarID: 'avatar-1',
    secretRef: 'worldmap',
    secretVersion: 1,
    root: hexToBytes(WORLDMAP_ROOT_HEX),
  });

  expect(result.secret).toBe(Buffer.from(expected).toString('hex'));
});

test('it derives diverging scope secrets across secret versions', async () => {
  const ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-keys' });

  const client = buildRPCTestClient<KeysContract>(ctx.app, { token: viewer.token });

  const versionOne = await client.deriveScopeSecret({
    avatarID: 'avatar-1',
    secretRef: 'worldmap',
    secretVersion: 1,
  });

  const versionTwo = await client.deriveScopeSecret({
    avatarID: 'avatar-1',
    secretRef: 'worldmap',
    secretVersion: 2,
  });

  expect(versionOne.secret).not.toBe(versionTwo.secret);
});

test('it rejects an unknown scope secret version with NOT_FOUND naming the ref and version', async () => {
  const ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-keys' });

  const client = buildRPCTestClient<KeysContract>(ctx.app, { token: viewer.token });

  expect(
    client.deriveScopeSecret({ avatarID: 'avatar-1', secretRef: 'worldmap', secretVersion: 99 }),
  ).rejects.toMatchObject({
    code: 'NOT_FOUND',
    data: { secretRef: 'worldmap', secretVersion: 99 },
  });
});

test('it rejects an /rpc call with no Authorization header with a plain 401', async () => {
  const ctx = await setupTest();

  const response = await ctx.app.handle(
    new Request('http://test.local/rpc/deriveAvatarKey', { method: 'POST' }),
  );

  expect(response.status).toBe(401);
});
