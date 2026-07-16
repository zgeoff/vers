import { expect, onTestFinished, spyOn, test } from 'bun:test';
import { implement } from '@orpc/server';
import { authedRoute, publicRoute } from '@vers/contract-base';
import { createServiceToken, getTestServiceKeyPair } from '@vers/service-test-utils/bun';
import { buildRPCTestClient, collectConformanceCases, waitFor } from '@vers/test-utils';
import { updateEnv } from '@vers/test-utils/bun';
import { expectTypeOf } from 'expect-type';
import * as z from 'zod';
import { createService } from './create-service';
import { sentryHandle } from './sentry-handle';
import type { ServiceContext } from './types';

function buildTestContract() {
  return {
    getThing: authedRoute
      .route({ method: 'GET', path: '/things' })
      .input(z.object({ id: z.string() }))
      .output(z.object({ id: z.string() })),
    ping: publicRoute.output(z.object({ pong: z.boolean() })),
    throwPlainError: publicRoute.output(z.object({})),
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
    throwPlainError: os.throwPlainError.handler(() => {
      throw new Error('a secret internal detail');
    }),
  };
}

test('it throws at boot when SERVICE_AUTH_PUBLIC_KEY is missing', () => {
  const originalPublicKey = process.env['SERVICE_AUTH_PUBLIC_KEY'];

  onTestFinished(() => {
    if (originalPublicKey !== undefined) {
      process.env['SERVICE_AUTH_PUBLIC_KEY'] = originalPublicKey;
    }
  });

  delete process.env['SERVICE_AUTH_PUBLIC_KEY'];
  const contract = buildTestContract();

  expect(
    createService({
      buildRouter: () => buildTestRouter(contract),
      envShape: {},
      name: 'test-service',
    }),
  ).rejects.toThrowWithMessage(Error, /SERVICE_AUTH_PUBLIC_KEY/);
});

test('it applies default PORT and LOG_LEVEL when unset', async () => {
  const keyPair = await getTestServiceKeyPair();

  const originalLogLevel = process.env['LOG_LEVEL'];
  const originalPort = process.env['PORT'];

  onTestFinished(() => {
    if (originalLogLevel !== undefined) {
      process.env['LOG_LEVEL'] = originalLogLevel;
    }

    if (originalPort !== undefined) {
      process.env['PORT'] = originalPort;
    }
  });

  delete process.env['LOG_LEVEL'];
  delete process.env['PORT'];
  updateEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    envShape: {},
    name: 'test-service',
  });

  expect(service.env.PORT).toBe(3000);
  expect(service.env.LOG_LEVEL).toBe('info');
});

test('it parses a service-specific envShape variable onto env', async () => {
  const keyPair = await getTestServiceKeyPair();

  updateEnv('CUSTOM_GREETING', 'hi there');
  updateEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    envShape: { CUSTOM_GREETING: z.string() },
    name: 'test-service',
  });

  expectTypeOf(service.env.PORT).toEqualTypeOf<number>();
  expectTypeOf(service.env.CUSTOM_GREETING).toEqualTypeOf<string>();
  expect(service.env.CUSTOM_GREETING).toBe('hi there');
});

test('it resolves when OTEL_EXPORTER_OTLP_ENDPOINT is set, wiring the OTel plugin and log shipping at boot', async () => {
  const keyPair = await getTestServiceKeyPair();

  updateEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://127.0.0.1:1/');
  updateEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  await expect(
    createService({
      buildRouter: () => buildTestRouter(contract),
      envShape: {},
      name: 'test-service',
    }),
  ).toResolve();
});

test('it serves a router built by an async buildRouter', async () => {
  const keyPair = await getTestServiceKeyPair();

  updateEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: async () => {
      await Promise.resolve();

      return buildTestRouter(contract);
    },
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

  expect(client.getThing({ id: 'thing-1' })).resolves.toStrictEqual({
    id: 'thing-1',
  });
});

test('it rejects an /rpc call with no Authorization header with a plain 401', async () => {
  const keyPair = await getTestServiceKeyPair();

  updateEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    envShape: {},
    name: 'test-service',
  });

  const response = await service.app.handle(
    new Request('http://test.local/rpc/ping', {
      headers: { traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' },
      method: 'POST',
    }),
  );

  expect(response.status).toBe(401);
  expect(response.headers.get('x-trace-id')).toBe('4bf92f3577b34da6a3ce929d0e0e4736');

  expect(response.json()).resolves.toStrictEqual({
    error: 'invalid-service-token',
  });
});

test('it rejects an /rpc call with a garbage token with a plain 401', async () => {
  const keyPair = await getTestServiceKeyPair();

  updateEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
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

  expect(response.json()).resolves.toStrictEqual({
    error: 'invalid-service-token',
  });
});

test('it rejects an /rpc call with an expired token with a plain 401', async () => {
  const keyPair = await getTestServiceKeyPair();

  updateEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
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

  expect(response.json()).resolves.toStrictEqual({
    error: 'invalid-service-token',
  });
});

test('it rejects an /rpc call with a wrong-audience token with a plain 401', async () => {
  const keyPair = await getTestServiceKeyPair();

  updateEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
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

  expect(response.json()).resolves.toStrictEqual({
    error: 'invalid-service-token',
  });
});

test('it returns data from an authed procedure given a valid token naming an acting user', async () => {
  const keyPair = await getTestServiceKeyPair();

  updateEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
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

  expect(client.getThing({ id: 'thing-1' })).resolves.toStrictEqual({
    id: 'thing-1',
  });
});

test('it throws a contract-shaped UNAUTHORIZED for an authed procedure given a valid anonymous token', async () => {
  const keyPair = await getTestServiceKeyPair();

  updateEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
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

  expect(client.getThing({ id: 'thing-1' })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});

test('it serves /health without any token', async () => {
  const keyPair = await getTestServiceKeyPair();

  updateEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    envShape: {},
    name: 'test-service',
  });

  const response = await service.app.handle(new Request('http://test.local/health'));

  expect(response.status).toBe(200);

  expect(response.json()).resolves.toStrictEqual({
    service: 'test-service',
    status: 'ok',
  });
});

test('it mints a fresh trace id when no traceparent is supplied', async () => {
  const keyPair = await getTestServiceKeyPair();

  updateEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    envShape: {},
    name: 'test-service',
  });

  const response = await service.app.handle(new Request('http://test.local/health'));

  expect(response.headers.get('x-trace-id')).toMatch(/^[0-9a-f]{32}$/);
});

test('it continues the trace named by an inbound traceparent header', async () => {
  const keyPair = await getTestServiceKeyPair();

  updateEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    envShape: {},
    name: 'test-service',
  });

  const response = await service.app.handle(
    new Request('http://test.local/health', {
      headers: { traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' },
    }),
  );

  expect(response.headers.get('x-trace-id')).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
});

test('it mints a fresh trace id for a malformed traceparent header', async () => {
  const keyPair = await getTestServiceKeyPair();

  updateEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    envShape: {},
    name: 'test-service',
  });

  const response = await service.app.handle(
    new Request('http://test.local/health', {
      headers: { traceparent: 'garbage' },
    }),
  );

  expect(response.headers.get('x-trace-id')).toMatch(/^[0-9a-f]{32}$/);
});

test('it masks an unexpected handler error as a bare INTERNAL_SERVER_ERROR', async () => {
  const keyPair = await getTestServiceKeyPair();

  updateEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
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

  expect(client.throwPlainError({})).rejects.toMatchObject({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
    status: 500,
  });
});

interface FakeSentryScope {
  readonly setTag: () => void;
}

test('it reports an unexpected handler error to the error backend exactly once', async () => {
  const keyPair = await getTestServiceKeyPair();

  updateEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);
  updateEnv('SENTRY_DSN', undefined);

  const contract = buildTestContract();
  const previousHandle = sentryHandle.current;
  const reported: Array<unknown> = [];

  onTestFinished(() => {
    sentryHandle.current = previousHandle;
  });

  // no SENTRY_DSN is set, so createService's own `startErrorReporting` call below no-ops and
  // never overwrites this stub — the only two calls `reportUnexpectedError` makes
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a hand-built stub exposing only the two calls reportUnexpectedError makes; a real SentryModule handle isn't buildable inline
  sentryHandle.current = {
    captureException: (error: unknown) => {
      reported.push(error);
    },
    withScope: (fn: (scope: Readonly<FakeSentryScope>) => void) => {
      fn({ setTag: () => {} });
    },
  } as unknown as NonNullable<typeof sentryHandle.current>;

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
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

  expect(client.throwPlainError({})).rejects.toMatchObject({
    code: 'INTERNAL_SERVER_ERROR',
  });

  await waitFor(() => {
    expect(reported).toHaveLength(1);
  });
});

test('it does not serve the dropped /api and /spec.json paths', async () => {
  const keyPair = await getTestServiceKeyPair();

  updateEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    envShape: {},
    name: 'test-service',
  });

  const apiResponse = await service.app.handle(
    new Request('http://test.local/api/things?id=thing-1'),
  );

  const specResponse = await service.app.handle(new Request('http://test.local/spec.json'));

  expect(apiResponse.status).toBe(404);
  expect(specResponse.status).toBe(404);
});

test('it passes every conformance case collected from its own contract', async () => {
  const keyPair = await getTestServiceKeyPair();

  updateEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
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

test('it logs one structured request line when an /rpc call completes', async () => {
  const keyPair = await getTestServiceKeyPair();

  updateEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    envShape: {},
    name: 'test-service',
  });

  const infoSpy = spyOn(service.logger, 'info');

  const token = await createServiceToken({
    audience: 'test-service',
    privateKey: keyPair.privateKey,
  });

  const client = buildRPCTestClient<ReturnType<typeof buildTestContract>>(service.app, {
    headers: { authorization: `Bearer ${token}` },
  });

  await client.ping();

  expect(infoSpy).toHaveBeenCalledExactlyOnceWith(
    {
      durationMs: expect.toBeNumber(),
      method: 'POST',
      path: '/rpc/ping',
      status: 200,
    },
    'request completed',
  );
});

test('it logs the rejection reason when the trust boundary rejects a request', async () => {
  const keyPair = await getTestServiceKeyPair();

  updateEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    envShape: {},
    name: 'test-service',
  });

  const warnSpy = spyOn(service.logger, 'warn');

  await service.app.handle(
    new Request('http://test.local/rpc/ping', {
      headers: { authorization: 'Bearer not-a-real-token' },
      method: 'POST',
    }),
  );

  expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
    {
      durationMs: expect.toBeNumber(),
      failure: 'invalid-service-token',
      method: 'POST',
      path: '/rpc/ping',
      status: 401,
    },
    'service token rejected',
  );
});

test('it logs a failed /rpc call at error severity', async () => {
  const keyPair = await getTestServiceKeyPair();

  updateEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    envShape: {},
    name: 'test-service',
  });

  const errorSpy = spyOn(service.logger, 'error');

  const token = await createServiceToken({
    audience: 'test-service',
    privateKey: keyPair.privateKey,
  });

  const client = buildRPCTestClient<ReturnType<typeof buildTestContract>>(service.app, {
    headers: { authorization: `Bearer ${token}` },
  });

  const pending = client.throwPlainError({});

  expect(pending).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });

  await expect(pending).toReject();

  expect(errorSpy).toHaveBeenCalledWith(
    {
      durationMs: expect.toBeNumber(),
      method: 'POST',
      path: '/rpc/throwPlainError',
      status: 500,
    },
    'request completed',
  );
});

test('it serves /health without logging a request line', async () => {
  const keyPair = await getTestServiceKeyPair();

  updateEnv('SERVICE_AUTH_PUBLIC_KEY', keyPair.publicKeyPEM);

  const contract = buildTestContract();

  const service = await createService({
    buildRouter: () => buildTestRouter(contract),
    envShape: {},
    name: 'test-service',
  });

  const infoSpy = spyOn(service.logger, 'info');

  await service.app.handle(new Request('http://test.local/health'));

  expect(infoSpy).not.toHaveBeenCalled();
});
