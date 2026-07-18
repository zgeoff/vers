import { expect, test } from 'bun:test';
import { bytesToHex } from '@noble/hashes/utils.js';
import { resolveServiceURL } from '@vers/mock-services';
import { mockKeysService } from '@vers/mock-services/keys';
import { getTestServiceKeyPair } from '@vers/service-test-utils/bun';
import { server } from '../mocks/server';
import { readAvatarRollKey } from './read-avatar-roll-key';

test('it reads the avatar roll key over real s2s auth against the mocked keys backend', async () => {
  const keyPair = await getTestServiceKeyPair();

  const key = await readAvatarRollKey(
    { keysServiceURL: resolveServiceURL('keys'), privateKey: keyPair.privateKey },
    { avatarID: 'avatar_1', keyVersion: 1 },
  );

  expect(bytesToHex(key)).toMatch(/^[0-9a-f]{64}$/);
});

test('it reads the identical key for the identical avatar and key version', async () => {
  const keyPair = await getTestServiceKeyPair();

  const deps = { keysServiceURL: resolveServiceURL('keys'), privateKey: keyPair.privateKey };

  const first = await readAvatarRollKey(deps, { avatarID: 'avatar_1', keyVersion: 1 });
  const second = await readAvatarRollKey(deps, { avatarID: 'avatar_1', keyVersion: 1 });

  expect(bytesToHex(second)).toBe(bytesToHex(first));
});

test('it reads a different key for a different avatar', async () => {
  const keyPair = await getTestServiceKeyPair();

  const deps = { keysServiceURL: resolveServiceURL('keys'), privateKey: keyPair.privateKey };

  const first = await readAvatarRollKey(deps, { avatarID: 'avatar_1', keyVersion: 1 });
  const second = await readAvatarRollKey(deps, { avatarID: 'avatar_2', keyVersion: 1 });

  expect(bytesToHex(second)).not.toBe(bytesToHex(first));
});

test('it reads a different key for a different key version of the same avatar', async () => {
  const keyPair = await getTestServiceKeyPair();

  const deps = { keysServiceURL: resolveServiceURL('keys'), privateKey: keyPair.privateKey };

  const first = await readAvatarRollKey(deps, { avatarID: 'avatar_1', keyVersion: 1 });
  const second = await readAvatarRollKey(deps, { avatarID: 'avatar_1', keyVersion: 2 });

  expect(bytesToHex(second)).not.toBe(bytesToHex(first));
});

test('it attaches a traceparent header to the outbound request', async () => {
  const keyPair = await getTestServiceKeyPair();

  const observedTraceparents: Array<string | null> = [];

  server.use(
    mockKeysService.deriveAvatarKey.handler((args) => {
      observedTraceparents.push(args.request.headers.get('traceparent'));

      return { key: 'a'.repeat(64) };
    }),
  );

  await readAvatarRollKey(
    { keysServiceURL: resolveServiceURL('keys'), privateKey: keyPair.privateKey },
    { avatarID: 'avatar_1', keyVersion: 1 },
  );

  const [observedTraceparent] = observedTraceparents;

  expect(observedTraceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/u);
});

test('it rejects when the keys service never responds', async () => {
  const keyPair = await getTestServiceKeyPair();

  server.use(mockKeysService.deriveAvatarKey.handler(() => new Promise<never>(() => {})));

  await expect(
    readAvatarRollKey(
      { keysServiceURL: resolveServiceURL('keys'), privateKey: keyPair.privateKey, timeoutMs: 50 },
      { avatarID: 'avatar_1', keyVersion: 1 },
    ),
  ).toReject();
});
