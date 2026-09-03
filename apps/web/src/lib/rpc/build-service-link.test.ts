import { expect, test } from 'bun:test';
import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import { buildContractMock } from '@vers/client-test-utils/orpc';
import { userContract } from '@vers/contract-user';
import * as db from '@vers/mock-services/db';
import { waitFor } from '@vers/test-utils';
import { delay } from 'msw';
import { SimulatedClock } from 'xstate';
import { server } from '../../mocks/node';
import { buildServiceLink } from './build-service-link';
import { SERVICE_URLS } from './service-urls';
import type { ServiceLinkContext } from './types';

test('it resends a GET-declared procedure whose first attempt hangs past its bound and returns the answer that lands', async () => {
  const user = await db.userCollection.create({});

  const clock = new SimulatedClock();

  const mockUser = buildContractMock({
    baseUrl: SERVICE_URLS.user,
    contract: userContract,
    resolveContext: () => ({}),
  });

  let callCount = 0;

  server.use(
    mockUser.getCurrentUser.handler(async () => {
      callCount += 1;

      if (callCount === 1) {
        await delay('infinite');
      }

      return user;
    }),
  );

  const client: ContractRouterClient<typeof userContract, ServiceLinkContext> = createORPCClient(
    buildServiceLink('user', userContract, { clock }),
  );

  const pending = client.getCurrentUser({}, { context: { actingUserID: user.id } });

  await waitFor(() => {
    expect(callCount).toBe(1);
  });

  clock.increment(2000);

  const result = await pending;

  expect(result).toMatchObject({ id: user.id });
  expect(callCount).toBe(2);
});

test('it sends a mutating procedure once and reports SERVICE_UNAVAILABLE when that attempt hangs past the whole budget', async () => {
  const clock = new SimulatedClock();

  const mockUser = buildContractMock({
    baseUrl: SERVICE_URLS.user,
    contract: userContract,
    resolveContext: () => ({}),
  });

  let callCount = 0;

  server.use(
    mockUser.updateEmail.handler(async () => {
      callCount += 1;

      await delay('infinite');

      return { updatedID: 'never' };
    }),
  );

  const client: ContractRouterClient<typeof userContract, ServiceLinkContext> = createORPCClient(
    buildServiceLink('user', userContract, { clock }),
  );

  const pending = client.updateEmail(
    { email: 'new@vers.test' },
    { context: { actingUserID: 'user-1' } },
  );

  await waitFor(() => {
    expect(callCount).toBe(1);
  });

  clock.increment(24_000);

  expect(pending).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });

  await expect(pending).toReject();

  expect(callCount).toBe(1);
});
