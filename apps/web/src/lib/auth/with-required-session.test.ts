import { expect, test } from 'bun:test';
import { buildContractMock } from '@vers/client-test-utils/orpc';
import { avatarContract } from '@vers/contract-avatar';
import { resolveSessionContext } from '@vers/mock-services';
import { server } from '../../mocks/node';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withRequestContext } from '../../test-utils/with-request-context';
import { avatarClient } from '../rpc/clients/avatar-client';
import { SERVICE_URLS } from '../rpc/service-urls';
import { getAuthSession } from './get-auth-session';
import { withRequiredSession } from './with-required-session';

function setupTest() {
  const mockAvatar = buildContractMock({
    baseUrl: SERVICE_URLS.avatar,
    contract: avatarContract,
    resolveContext: resolveSessionContext,
  });

  return { mockAvatar };
}

test('it resolves the value of a call the service accepts', async () => {
  const signedIn = await createSignedInUser();

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, () =>
    withRequiredSession(() => avatarClient.getAvatars({})),
  );

  expect(outcome.value).toStrictEqual({ activeAvatarID: null, avatars: [] });
});

test('it signs the caller out and redirects to login when the service rejects the session as unauthorized', async () => {
  const ctx = setupTest();

  const signedIn = await createSignedInUser();

  server.use(
    ctx.mockAvatar.getAvatars.handler((opts) => {
      throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
    }),
  );

  const outcome = await withRequestContext(
    { cookies: signedIn.cookies, url: 'http://localhost/explore' },
    async () => {
      const promise = withRequiredSession(() => avatarClient.getAvatars({}));

      // the cookie read below must observe the rejected call's clear-session step settled
      await promise.catch(() => {});

      expect(promise).rejects.toMatchObject({ options: { href: '/login?redirect=%2Fexplore' } });

      return getAuthSession();
    },
  );

  expect(outcome.value).toStrictEqual({});
});

test('it rethrows a service fault and keeps the caller signed in', async () => {
  const ctx = setupTest();

  const signedIn = await createSignedInUser();

  server.use(
    ctx.mockAvatar.getAvatars.handler(() => {
      throw new Error('the avatar service is unreachable');
    }),
  );

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const promise = withRequiredSession(() => avatarClient.getAvatars({}));

    await promise.catch(() => {});

    expect(promise).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });

    return getAuthSession();
  });

  expect(outcome.value).toContainEntry(['sessionID', signedIn.sessionID]);
});

test('it rethrows a declared error other than unauthorized and keeps the caller signed in', async () => {
  const ctx = setupTest();

  const signedIn = await createSignedInUser();

  server.use(
    ctx.mockAvatar.getAvatars.handler((opts) => {
      throw opts.errors.FORBIDDEN({ data: {} });
    }),
  );

  const outcome = await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const promise = withRequiredSession(() => avatarClient.getAvatars({}));

    await promise.catch(() => {});

    expect(promise).rejects.toMatchObject({ code: 'FORBIDDEN' });

    return getAuthSession();
  });

  expect(outcome.value).toContainEntry(['sessionID', signedIn.sessionID]);
});
