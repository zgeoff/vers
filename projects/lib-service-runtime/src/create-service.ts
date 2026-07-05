import type { AnyContractRouter, OpenAPI } from '@orpc/contract';
import type { AnyRouter } from '@orpc/server';
import type { FetchHandler } from '@orpc/server/fetch';
import type { CryptoKey } from 'jose';
import type pino from 'pino';
import { OpenAPIGenerator } from '@orpc/openapi';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { RPCHandler } from '@orpc/server/fetch';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { Elysia } from 'elysia';
import * as jose from 'jose';
import * as z from 'zod';
import type { ServiceContext } from './types';
import { BASE_ENV_SCHEMA } from './base-env-schema';
import { createLogger } from './create-logger';
import { parseServiceToken } from './parse-service-token';
import { TOKEN_ALGORITHM } from './token-claims';

type ServiceEnv<TEnvShape extends z.ZodRawShape> = z.infer<
  typeof BASE_ENV_SCHEMA
> &
  z.infer<z.ZodObject<TEnvShape>>;

export interface ServiceConfig<TEnvShape extends z.ZodRawShape> {
  buildRouter: (runtime: {
    env: ServiceEnv<TEnvShape>;
    logger: pino.Logger;
  }) => AnyRouter;
  contract: AnyContractRouter;
  envShape: TEnvShape;
  name: string;
}

export interface Service<TEnvShape extends z.ZodRawShape> {
  app: Elysia;
  env: ServiceEnv<TEnvShape>;
  listen: () => void;
  logger: pino.Logger;
}

/**
 * Boots the Elysia shell every service composes: env validation, s2s token verification ahead of
 * the oRPC handlers, health checks, request-id propagation, and optional Sentry/OTel wiring.
 * Nothing is started — call the returned `listen` to bind a port.
 */
export async function createService<
  TEnvShape extends z.ZodRawShape = Record<never, never>,
>(config: ServiceConfig<TEnvShape>): Promise<Service<TEnvShape>> {
  const env = parseServiceEnv(config.envShape);
  const logger = createLogger({ level: env.LOG_LEVEL, name: config.name });
  const publicKey = await jose.importSPKI(
    env.SERVICE_AUTH_PUBLIC_KEY,
    TOKEN_ALGORITHM,
  );

  if (env.SENTRY_DSN) {
    const sentry = await import('@sentry/bun');

    sentry.init({ dsn: env.SENTRY_DSN });
  }

  const router = config.buildRouter({ env, logger });
  const document = await buildOpenAPIDocument(config.contract, config.name);
  const app = new Elysia();

  if (env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    const [{ opentelemetry }, { OTLPTraceExporter }] = await Promise.all([
      import('@elysiajs/opentelemetry'),
      import('@opentelemetry/exporter-trace-otlp-proto'),
    ]);

    app.use(
      opentelemetry({
        serviceName: config.name,
        traceExporter: new OTLPTraceExporter({
          url: env.OTEL_EXPORTER_OTLP_ENDPOINT,
        }),
      }),
    );
  }

  app.get('/health', ({ request, set }) => {
    set.headers['x-request-id'] = getRequestId(request);

    return { service: config.name, status: 'ok' };
  });

  app.get('/spec.json', ({ request, set }) => {
    set.headers['x-request-id'] = getRequestId(request);

    return document;
  });

  mountORPCHandler(app, '/rpc', new RPCHandler(router), {
    logger,
    publicKey,
    serviceName: config.name,
  });
  mountORPCHandler(app, '/api', new OpenAPIHandler(router), {
    logger,
    publicKey,
    serviceName: config.name,
  });

  return {
    app,
    env,
    listen: () => {
      app.listen(env.PORT);
      logger.info(`${config.name} listening on port ${env.PORT}`);
    },
    logger,
  };
}

/** Parses the base + service-specific environment shape against `process.env`, failing fast. */
function parseServiceEnv<TEnvShape extends z.ZodRawShape>(
  envShape: TEnvShape,
): ServiceEnv<TEnvShape> {
  const base = BASE_ENV_SCHEMA.safeParse(process.env);
  const extra = z.object(envShape).safeParse(process.env);

  if (!base.success || !extra.success) {
    const baseIssues = base.success ? [] : base.error.issues;
    const extraIssues = extra.success ? [] : extra.error.issues;

    throw new Error(
      `invalid service environment:\n${z.prettifyError(new z.ZodError([...baseIssues, ...extraIssues]))}`,
    );
  }

  return { ...base.data, ...extra.data };
}

/** Generates the service's OpenAPI document from its contract, never its implementation. */
async function buildOpenAPIDocument(
  contract: AnyContractRouter,
  name: string,
): Promise<OpenAPI.Document> {
  const generator = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()],
  });

  return generator.generate(contract, {
    info: { title: name, version: '0.0.0' },
  });
}

/** Reads the incoming request-id, or mints one when the caller didn't supply it. */
function getRequestId(request: Request): string {
  return request.headers.get('x-request-id') ?? crypto.randomUUID();
}

/**
 * Mounts an oRPC fetch handler behind the s2s trust boundary: an invalid service token short-
 * circuits with a plain 401 before the handler ever runs, per the auth/trust-boundary split in
 * docs/002-service-contracts.md.
 */
function mountORPCHandler(
  app: Elysia,
  prefix: `/${string}`,
  handler: FetchHandler<ServiceContext>,
  deps: { logger: pino.Logger; publicKey: CryptoKey; serviceName: string },
): void {
  app.all(
    `${prefix}*` as `/${string}`,
    async ({ request }) => {
      const requestId = getRequestId(request);
      const resolution = await parseServiceToken(request, {
        audience: deps.serviceName,
        publicKey: deps.publicKey,
      });

      if ('failure' in resolution) {
        const response = Response.json(
          { error: resolution.failure },
          { status: 401 },
        );

        response.headers.set('x-request-id', requestId);

        return response;
      }

      const { matched, response } = await handler.handle(request, {
        context: {
          actingUserId: resolution.actingUserId,
          logger: deps.logger.child({ requestId }),
          requestId,
        },
        prefix,
      });
      const finalResponse = matched
        ? response
        : new Response('not found', { status: 404 });

      finalResponse.headers.set('x-request-id', requestId);

      return finalResponse;
    },
    { parse: 'none' },
  );
}
