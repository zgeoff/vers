import { expect, onTestFinished, test } from 'bun:test';
import { resolveServiceURL } from '@vers/mock-services';
import { resolveTestServiceKeyPair } from '@vers/service-test-utils/bun';
import { decodeJwt } from 'jose';
import type { LifeCycleEventsMap } from 'msw';
import { createKeysClient } from './create-keys-client';
import { server } from './mocks/server';

async function setupTest() {
  const keyPair = await resolveTestServiceKeyPair();

  return {
    keysClient: createKeysClient({
      keysServiceURL: resolveServiceURL('keys'),
      privateKey: keyPair.privateKey,
    }),
  };
}

test('it sends each keys call a service token from service-activity for the keys audience', async () => {
  const ctx = await setupTest();

  const authorizations: Array<string | null> = [];

  const recordAuthorization = (...args: LifeCycleEventsMap['request:start']): void => {
    authorizations.push(args[0].request.headers.get('authorization'));
  };

  server.events.on('request:start', recordAuthorization);

  onTestFinished(() => {
    server.events.removeListener('request:start', recordAuthorization);
  });

  await ctx.keysClient.deriveAvatarKey({
    avatarID: 'avatar_plover',
    keyVersion: 1,
    population: 'trade',
  });

  await ctx.keysClient.deriveScopeSecret({
    avatarID: 'avatar_plover',
    secretRef: 'worldmap',
    secretVersion: 1,
  });

  const claims = authorizations.map((authorization) =>
    decodeJwt((authorization ?? '').replace(/^Bearer /u, '')),
  );

  expect(claims).toStrictEqual([
    { aud: 'service-keys', exp: expect.any(Number), iss: 'service-activity' },
    { aud: 'service-keys', exp: expect.any(Number), iss: 'service-activity' },
  ]);
});
