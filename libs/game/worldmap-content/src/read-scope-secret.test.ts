import { expect, test } from 'bun:test';
import { bytesToHex } from '@noble/hashes/utils.js';
import { resolveServiceURL } from '@vers/mock-services';
import { buildMockScopeSecret, mockKeysService } from '@vers/mock-services/keys';
import { getTestServiceKeyPair } from '@vers/service-test-utils/bun';
import { server } from './mocks/server';
import { readScopeSecret } from './read-scope-secret';

test('it reads the mocked scope secret over real s2s auth against the mocked keys backend', async () => {
  const keyPair = await getTestServiceKeyPair();

  const secret = await readScopeSecret(
    {
      issuer: 'service-activity',
      keysServiceURL: resolveServiceURL('keys'),
      privateKey: keyPair.privateKey,
    },
    { avatarID: 'avatar_1', secretRef: 'worldmap', secretVersion: 1 },
  );

  expect(bytesToHex(secret)).toBe(bytesToHex(buildMockScopeSecret('avatar_1', 'worldmap', 1)));
});

test('it reads the identical secret for the identical avatar and secret version', async () => {
  const keyPair = await getTestServiceKeyPair();

  const deps = {
    issuer: 'service-activity' as const,
    keysServiceURL: resolveServiceURL('keys'),
    privateKey: keyPair.privateKey,
  };

  const first = await readScopeSecret(deps, {
    avatarID: 'avatar_1',
    secretRef: 'worldmap',
    secretVersion: 1,
  });

  const second = await readScopeSecret(deps, {
    avatarID: 'avatar_1',
    secretRef: 'worldmap',
    secretVersion: 1,
  });

  expect(bytesToHex(second)).toBe(bytesToHex(first));
});

test('it reads a different secret for a different avatar', async () => {
  const keyPair = await getTestServiceKeyPair();

  const deps = {
    issuer: 'service-activity' as const,
    keysServiceURL: resolveServiceURL('keys'),
    privateKey: keyPair.privateKey,
  };

  const first = await readScopeSecret(deps, {
    avatarID: 'avatar_1',
    secretRef: 'worldmap',
    secretVersion: 1,
  });

  const second = await readScopeSecret(deps, {
    avatarID: 'avatar_2',
    secretRef: 'worldmap',
    secretVersion: 1,
  });

  expect(bytesToHex(second)).not.toBe(bytesToHex(first));
});

test('it rethrows a keys-defined NOT_FOUND as a plain Error naming the ref and version', async () => {
  const keyPair = await getTestServiceKeyPair();

  server.use(
    mockKeysService.deriveScopeSecret.handler((args) => {
      throw args.errors.NOT_FOUND({
        data: { secretRef: args.input.secretRef, secretVersion: args.input.secretVersion },
      });
    }),
  );

  expect(
    readScopeSecret(
      {
        issuer: 'service-activity',
        keysServiceURL: resolveServiceURL('keys'),
        privateKey: keyPair.privateKey,
      },
      { avatarID: 'avatar_1', secretRef: 'worldmap', secretVersion: 99 },
    ),
  ).rejects.toThrow(/keys service has no root for secretRef "worldmap" version 99/);
});

test('it rejects when the keys service never responds', async () => {
  const keyPair = await getTestServiceKeyPair();

  server.use(mockKeysService.deriveScopeSecret.handler(() => new Promise<never>(() => {})));

  await expect(
    readScopeSecret(
      {
        issuer: 'service-activity',
        keysServiceURL: resolveServiceURL('keys'),
        privateKey: keyPair.privateKey,
        timeoutMs: 50,
      },
      { avatarID: 'avatar_1', secretRef: 'worldmap', secretVersion: 1 },
    ),
  ).toReject();
});
