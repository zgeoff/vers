import { expect, test } from 'bun:test';
import { bytesToHex } from '@noble/hashes/utils.js';
import { resolveServiceURL } from '@vers/mock-services';
import { buildMockScopeSecret, mockKeysService } from '@vers/mock-services/keys';
import { resolveTestServiceKeyPair } from '@vers/service-test-utils/bun';
import { server } from './mocks/server';
import { readAvatarKeys } from './read-avatar-keys';

async function setupTest() {
  const keyPair = await resolveTestServiceKeyPair();

  return { deps: { keysServiceURL: resolveServiceURL('keys'), privateKey: keyPair.privateKey } };
}

test("it reads the avatar's roll key from the keys service", async () => {
  const ctx = await setupTest();

  server.use(mockKeysService.deriveAvatarKey.handler(() => ({ key: 'ab'.repeat(32) })));

  const keys = await readAvatarKeys(ctx.deps, {
    avatarID: 'avatar_heron',
    keyVersion: 1,
    secretRef: 'worldmap',
    secretVersion: 1,
  });

  expect(bytesToHex(keys.rollKey)).toBe('ab'.repeat(32));
});

test("it reads the avatar's worldmap scope secret from the keys service", async () => {
  const ctx = await setupTest();

  const keys = await readAvatarKeys(ctx.deps, {
    avatarID: 'avatar_heron',
    keyVersion: 1,
    secretRef: 'worldmap',
    secretVersion: 1,
  });

  expect(bytesToHex(keys.scopeSecret)).toBe(
    bytesToHex(buildMockScopeSecret('avatar_heron', 'worldmap', 1)),
  );
});

test('it asks the keys service for the roll key of the trade population at the given version', async () => {
  const ctx = await setupTest();

  const requested: Array<unknown> = [];

  server.use(
    mockKeysService.deriveAvatarKey.handler((args) => {
      requested.push(args.input);

      return { key: 'cd'.repeat(32) };
    }),
  );

  await readAvatarKeys(ctx.deps, {
    avatarID: 'avatar_heron',
    keyVersion: 3,
    secretRef: 'worldmap',
    secretVersion: 1,
  });

  expect(requested).toStrictEqual([
    { avatarID: 'avatar_heron', keyVersion: 3, population: 'trade' },
  ]);
});
