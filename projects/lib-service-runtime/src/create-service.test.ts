import { implement } from '@orpc/server';
import { authedRoute, publicRoute } from '@vers/contract-base';
import { buildRPCTestClient, collectConformanceCases } from '@vers/contract-base/test-utils';
import { expect, expectTypeOf, test, vi } from 'vitest';
import * as z from 'zod';
import { createService } from './create-service';
import { createServiceKeyPair } from './test-utils/create-service-key-pair';
import { createServiceToken } from './test-utils/create-service-token';
import type { ServiceContext } from './types';

function buildTestContract() {
  return {
    getThing: authedRoute
      .route({ method: 'GET', path: '/things' })
      .input(z.object({ id: z.string() }))
      .output(z.object({ id: z.string() })),
    ping: publicRoute.output(z.object({ pong: z.boolean() })),
  };
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- structural map of oRPC contract procedures; framework types with no readonly form
function buildTestRouter(contract: ReturnType<typeof buildTestContract>) {
  const os = implement(contract).$context<ServiceContext>();

  return {
    getThing: os.getThing.handler((opts) => {
      if (opts.context.actingUserId === null) {
        throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
      }

      return { id: opts.input.id };
    }),
    ping: os.ping.handler(() => ({ pong: true })),
  };
}

test('it throws at boot when SERVICE_AUTH_PUBLIC_KEY is missing', async () => {
  vi.stubEnv('SERVICE_AUTH_PUBLIC_KEY', undefined);

  const contract = buildTestContract();

  await expect(
    createService({
      buildRouter: () => buildTestRouter(contract),
      contract,
      envShape: {},
      name: 'test-service',
    }),
  ).rejects.toThrowWithMessage(Error, /SERVICE_AUTH_PUBLIC_KEY/);
});

test('it applies default PORT and LOG_LEVEL when unset', async () => {
  const keyPair = await createServiceKeyPair();

  vi.stubEnv('LOG_LEVEL', undefined);
  vi.stubEnv('PORT', undefined);
  vi.stubEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    contract,
    envShape: {},
    name: 'test-service',
  });

  expect(service.env.PORT).toBe(3000);
  expect(service.env.LOG_LEVEL).toBe('info');
});

test('it parses a service-specific envShape variable onto env', async () => {
  const keyPair = await createServiceKeyPair();

  vi.stubEnv('CUSTOM_GREETING', 'hi there');
  vi.stubEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    contract,
    envShape: { CUSTOM_GREETING: z.string() },
    name: 'test-service',
  });

  expectTypeOf(service.env.PORT).toEqualTypeOf<number>();
  expectTypeOf(service.env.CUSTOM_GREETING).toEqualTypeOf<string>();
  expect(service.env.CUSTOM_GREETING).toBe('hi there');
});

test('it resolves when OTEL_EXPORTER_OTLP_ENDPOINT is set, wiring the OTel plugin at boot', async () => {
  const keyPair = await createServiceKeyPair();

  vi.stubEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://127.0.0.1:1/');
  vi.stubEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  await expect(
    createService({
      buildRouter: () => buildTestRouter(contract),
      contract,
      envShape: {},
      name: 'test-service',
    }),
  ).toResolve();
});

test('it serves a router built by an async buildRouter', async () => {
  const keyPair = await createServiceKeyPair();

  vi.stubEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: async () => {
      await Promise.resolve();

      return buildTestRouter(contract);
    },
    contract,
    envShape: {},
    name: 'test-service',
  });

  const token = await createServiceToken({
    actingUserId: 'user-1',
    audience: 'test-service',
    privateKey: keyPair.privateKey,
  });

  const client = buildRPCTestClient<ReturnType<typeof buildTestContract>>(service.app, {
    headers: { authorization: `Bearer ${token}` },
  });

  await expect(client.getThing({ id: 'thing-1' })).resolves.toStrictEqual({
    id: 'thing-1',
  });
});

test('it rejects an /rpc call with no Authorization header with a plain 401', async () => {
  const keyPair = await createServiceKeyPair();

  vi.stubEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    contract,
    envShape: {},
    name: 'test-service',
  });

  const response = await service.app.handle(
    new Request('http://test.local/rpc/ping', {
      headers: { 'x-request-id': 'abc' },
      method: 'POST',
    }),
  );

  expect(response.status).toBe(401);
  expect(response.headers.get('x-request-id')).toBe('abc');

  await expect(response.json()).resolves.toStrictEqual({
    error: 'invalid-service-token',
  });
});

test('it rejects an /rpc call with a garbage token with a plain 401', async () => {
  const keyPair = await createServiceKeyPair();

  vi.stubEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    contract,
    envShape: {},
    name: 'test-service',
  });

  const response = await service.app.handle(
    new Request('http://test.local/rpc/ping', {
      headers: { authorization: 'Bearer not-a-real-token' },
      method: 'POST',
    }),
  );

  expect(response.status).toBe(401);

  await expect(response.json()).resolves.toStrictEqual({
    error: 'invalid-service-token',
  });
});

test('it rejects an /rpc call with an expired token with a plain 401', async () => {
  const keyPair = await createServiceKeyPair();

  vi.stubEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    contract,
    envShape: {},
    name: 'test-service',
  });

  const token = await createServiceToken({
    audience: 'test-service',
    expiresIn: '-1s',
    privateKey: keyPair.privateKey,
  });

  const response = await service.app.handle(
    new Request('http://test.local/rpc/ping', {
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
    }),
  );

  expect(response.status).toBe(401);

  await expect(response.json()).resolves.toStrictEqual({
    error: 'invalid-service-token',
  });
});

test('it rejects an /rpc call with a wrong-audience token with a plain 401', async () => {
  const keyPair = await createServiceKeyPair();

  vi.stubEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    contract,
    envShape: {},
    name: 'test-service',
  });

  const token = await createServiceToken({
    audience: 'some-other-service',
    privateKey: keyPair.privateKey,
  });

  const response = await service.app.handle(
    new Request('http://test.local/rpc/ping', {
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
    }),
  );

  expect(response.status).toBe(401);

  await expect(response.json()).resolves.toStrictEqual({
    error: 'invalid-service-token',
  });
});

test('it returns data from an authed procedure given a valid token naming an acting user', async () => {
  const keyPair = await createServiceKeyPair();

  vi.stubEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    contract,
    envShape: {},
    name: 'test-service',
  });

  const token = await createServiceToken({
    actingUserId: 'user-1',
    audience: 'test-service',
    privateKey: keyPair.privateKey,
  });

  const client = buildRPCTestClient<ReturnType<typeof buildTestContract>>(service.app, {
    headers: { authorization: `Bearer ${token}` },
  });

  await expect(client.getThing({ id: 'thing-1' })).resolves.toStrictEqual({
    id: 'thing-1',
  });
});

test('it throws a contract-shaped UNAUTHORIZED for an authed procedure given a valid anonymous token', async () => {
  const keyPair = await createServiceKeyPair();

  vi.stubEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    contract,
    envShape: {},
    name: 'test-service',
  });

  const token = await createServiceToken({
    audience: 'test-service',
    privateKey: keyPair.privateKey,
  });

  const client = buildRPCTestClient<ReturnType<typeof buildTestContract>>(service.app, {
    headers: { authorization: `Bearer ${token}` },
  });

  await expect(client.getThing({ id: 'thing-1' })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});

test('it serves /health without any token', async () => {
  const keyPair = await createServiceKeyPair();

  vi.stubEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    contract,
    envShape: {},
    name: 'test-service',
  });

  const response = await service.app.handle(new Request('http://test.local/health'));

  expect(response.status).toBe(200);

  await expect(response.json()).resolves.toStrictEqual({
    service: 'test-service',
    status: 'ok',
  });
});

test('it echoes a supplied x-request-id and mints one when absent', async () => {
  const keyPair = await createServiceKeyPair();

  vi.stubEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    contract,
    envShape: {},
    name: 'test-service',
  });

  const withoutHeader = await service.app.handle(new Request('http://test.local/health'));

  expect(withoutHeader.headers.get('x-request-id')).toBeString();

  const withHeader = await service.app.handle(
    new Request('http://test.local/health', {
      headers: { 'x-request-id': 'abc' },
    }),
  );

  expect(withHeader.headers.get('x-request-id')).toBe('abc');
});

test('it serves /spec.json declaring the 401 response for the authed route', async () => {
  const keyPair = await createServiceKeyPair();

  vi.stubEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    contract,
    envShape: {},
    name: 'test-service',
  });

  const response = await service.app.handle(new Request('http://test.local/spec.json'));

  expect(response.status).toBe(200);

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- baseline(#236)
  const document = (await response.json()) as {
    paths: Record<string, { get?: { responses: Record<string, unknown> } }>;
  };

  expect(Object.keys(document.paths)).not.toBeEmpty();
  expect(document.paths['/things']?.get?.responses).toContainKey('401');
});

test('it serves the authed route over /api given a valid token', async () => {
  const keyPair = await createServiceKeyPair();

  vi.stubEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    contract,
    envShape: {},
    name: 'test-service',
  });

  const token = await createServiceToken({
    actingUserId: 'user-1',
    audience: 'test-service',
    privateKey: keyPair.privateKey,
  });

  const response = await service.app.handle(
    new Request('http://test.local/api/things?id=thing-1', {
      headers: { authorization: `Bearer ${token}`, 'x-request-id': 'abc' },
    }),
  );

  expect(response.status).toBe(200);
  expect(response.headers.get('x-request-id')).toBe('abc');

  await expect(response.json()).resolves.toStrictEqual({ id: 'thing-1' });
});

test('it passes every conformance case collected from its own contract', async () => {
  const keyPair = await createServiceKeyPair();

  vi.stubEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    contract,
    envShape: {},
    name: 'test-service',
  });

  const anonymousToken = await createServiceToken({
    audience: 'test-service',
    privateKey: keyPair.privateKey,
  });

  const cases = collectConformanceCases(contract, {
    anonymousHeaders: { authorization: `Bearer ${anonymousToken}` },
    authedSamples: { getThing: { id: 'thing-1' } },
  });

  for (const conformanceCase of cases) {
    await expect(conformanceCase.run(service.app)).toResolve();
  }
});
