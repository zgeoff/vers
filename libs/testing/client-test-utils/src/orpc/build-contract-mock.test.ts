import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import { oc } from '@orpc/contract';
import { implement } from '@orpc/server';
import * as z from 'zod';
import { buildContractMock } from './build-contract-mock';
import { buildMockService } from './build-mock-service';
import { server } from './mocks/server';

type SecretContext = Record<string, unknown> & { actingUserID: string | null };

function setupTest() {
  const contract = {
    getOther: oc
      .route({ method: 'GET', path: '/other' })
      .input(z.object({}))
      .output(z.object({ value: z.string() })),

    getSecret: oc
      .errors({ UNAUTHORIZED: { data: z.object({ reason: z.string() }) } })
      .route({ method: 'GET', path: '/secret' })
      .input(z.object({}))
      .output(z.object({ value: z.string() })),
  };

  const implementer = implement(contract).$context<SecretContext>();

  server.use(
    ...buildMockService({
      baseUrl: 'http://secret.test',
      contract,
      resolveContext: (request: Request): SecretContext => {
        const header = request.headers.get('authorization') ?? '';
        const actingUserID = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

        return { actingUserID };
      },
      router: {
        getOther: implementer.getOther.handler(() => ({ value: 'base-other' })),
        getSecret: implementer.getSecret.handler((opts) => ({
          value: `base-secret-for-${opts.context.actingUserID ?? 'anonymous'}`,
        })),
      },
    }),
  );

  return { contract };
}

test('it resolves the actingUserID a client forwards via the Authorization header', async () => {
  const ctx = setupTest();

  const client: ContractRouterClient<typeof ctx.contract> = createORPCClient(
    new RPCLink<Record<string, never>>({
      headers: { authorization: 'Bearer user_1' },
      url: 'http://secret.test/rpc',
    }),
  );

  const result = await client.getSecret({});

  expect(result).toStrictEqual({ value: 'base-secret-for-user_1' });
});

test('it overrides only the mocked procedure, leaving the rest on the base backend', async () => {
  const ctx = setupTest();

  const mock = buildContractMock({
    baseUrl: 'http://secret.test',
    contract: ctx.contract,
    resolveContext: (request: Request): SecretContext => {
      const header = request.headers.get('authorization') ?? '';
      const actingUserID = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

      return { actingUserID };
    },
  });

  server.use(
    mock.getSecret.handler((opts) => ({
      value: `overridden-for-${opts.context.actingUserID}`,
    })),
  );

  const client: ContractRouterClient<typeof ctx.contract> = createORPCClient(
    new RPCLink<Record<string, never>>({
      headers: { authorization: 'Bearer user_2' },
      url: 'http://secret.test/rpc',
    }),
  );

  const secret = await client.getSecret({});
  const other = await client.getOther({});

  expect(secret).toStrictEqual({ value: 'overridden-for-user_2' });
  expect(other).toStrictEqual({ value: 'base-other' });
});

test('it surfaces a mock-thrown typed error as a defined ORPCError client-side', () => {
  const ctx = setupTest();

  const mock = buildContractMock({
    baseUrl: 'http://secret.test',
    contract: ctx.contract,
    resolveContext: (request: Request): SecretContext => {
      const header = request.headers.get('authorization') ?? '';
      const actingUserID = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

      return { actingUserID };
    },
  });

  server.use(
    mock.getSecret.handler((opts) => {
      throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
    }),
  );

  const client: ContractRouterClient<typeof ctx.contract> = createORPCClient(
    new RPCLink<Record<string, never>>({
      headers: { authorization: 'Bearer user_3' },
      url: 'http://secret.test/rpc',
    }),
  );

  expect(client.getSecret({})).rejects.toMatchObject({ data: { reason: 'missing-session' } });
});

test('it overrides a nested-namespace procedure while a sibling top-level call stays on the base backend', async () => {
  const authContract = {
    getStatus: oc
      .route({ method: 'GET', path: '/status' })
      .input(z.object({}))
      .output(z.object({ status: z.string() })),

    stepUp: {
      getPendingTransaction: oc
        .route({ method: 'GET', path: '/step-up/pending' })
        .input(z.object({}))
        .output(z.object({ transactionID: z.string() })),
    },
  };

  const implementer = implement(authContract);

  server.use(
    ...buildMockService({
      baseUrl: 'http://auth.test',
      contract: authContract,
      resolveContext: () => ({}),
      router: {
        getStatus: implementer.getStatus.handler(() => ({ status: 'base-status' })),
        stepUp: {
          getPendingTransaction: implementer.stepUp.getPendingTransaction.handler(() => ({
            transactionID: 'base-txn',
          })),
        },
      },
    }),
  );

  const mock = buildContractMock({
    baseUrl: 'http://auth.test',
    contract: authContract,
    resolveContext: () => ({}),
  });

  server.use(
    mock.stepUp.getPendingTransaction.handler(() => ({ transactionID: 'overridden-txn' })),
  );

  const link = new RPCLink<Record<string, never>>({ url: 'http://auth.test/rpc' });

  const client: ContractRouterClient<typeof authContract> = createORPCClient(link);

  const pending = await client.stepUp.getPendingTransaction({});
  const status = await client.getStatus({});

  expect(pending).toStrictEqual({ transactionID: 'overridden-txn' });
  expect(status).toStrictEqual({ status: 'base-status' });
});

test('it surfaces a raw Response returned by a mock handler verbatim to the client transport', async () => {
  const rawContract = {
    getSecret: oc
      .route({ method: 'GET', path: '/secret' })
      .input(z.object({}))
      .output(z.object({ value: z.string() })),
  };

  const mock = buildContractMock({
    baseUrl: 'http://raw.test',
    contract: rawContract,
    resolveContext: () => ({}),
  });

  server.use(
    mock.getSecret.handler(
      () =>
        new Response('teapot', {
          headers: { 'x-raw': 'yes' },
          status: 418,
        }),
    ),
  );

  let transportResponse: Response | undefined;

  const sendRequest = async (request: Request): Promise<Response> => {
    const response = await fetch(request);

    transportResponse = response.clone();

    return response;
  };

  const link = new RPCLink<Record<string, never>>({
    fetch: sendRequest,
    url: 'http://raw.test/rpc',
  });

  const client: ContractRouterClient<typeof rawContract> = createORPCClient(link);

  await expect(client.getSecret({})).toReject();

  assert.ok(transportResponse, 'expected the transport to receive a response');

  const body = await transportResponse.text();

  expect(transportResponse.status).toBe(418);
  expect(transportResponse.headers.get('x-raw')).toBe('yes');
  expect(body).toBe('teapot');
});
