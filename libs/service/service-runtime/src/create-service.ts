import type { AnyRouter } from '@orpc/server';
import { ORPCError, onError } from '@orpc/server';
import type { FetchHandler } from '@orpc/server/fetch';
import { RPCHandler } from '@orpc/server/fetch';
import type { ServiceKeySet } from '@vers/service-auth';
import { parseServiceJWKS, parseServiceToken } from '@vers/service-auth';
import { findSpanTraceContext, withTraceContext } from '@vers/service-utils';
import type { MetricsExport, OTLPLogStream } from '@vers/service-utils/otel';
import type { TraceContext } from '@vers/trace';
import { createTraceContext, parseTraceparent } from '@vers/trace';
import { Elysia } from 'elysia';
import type pino from 'pino';
import * as z from 'zod';
import { baseEnvSchema } from './base-env-schema';
import { createLogger } from './create-logger';
import { reportUnexpectedError } from './report-unexpected-error';
import { shouldTraceRequest } from './should-trace-request';
import { startErrorReporting } from './start-error-reporting';
import type { ServiceContext } from './types';

type ServiceEnv<TEnvShape extends z.ZodRawShape> = z.infer<typeof baseEnvSchema> &
  z.infer<z.ZodObject<TEnvShape>>;

interface ServiceRuntime<TEnvShape extends z.ZodRawShape> {
  readonly env: Readonly<ServiceEnv<TEnvShape>>;
  readonly logger: pino.Logger;
}

export interface ServiceConfig<TEnvShape extends z.ZodRawShape> {
  readonly buildRouter: (runtime: ServiceRuntime<TEnvShape>) => AnyRouter | Promise<AnyRouter>;
  readonly envShape: TEnvShape;
  readonly name: string;
  readonly slowRequestMs?: number;
  readonly slowRequestOverridesMs?: Readonly<Record<string, number>>;
}

export interface Service<TEnvShape extends z.ZodRawShape> {
  app: Elysia;
  env: ServiceEnv<TEnvShape>;
  listen: (port?: number) => void;
  logger: pino.Logger;
  stopTelemetry: () => Promise<void>;
}

const DEFAULT_SLOW_REQUEST_MS = 2000;

export async function createService<TEnvShape extends z.ZodRawShape = Record<never, never>>(
  config: ServiceConfig<TEnvShape>,
): Promise<Service<TEnvShape>> {
  const env = parseServiceEnv(config.envShape);

  const otlpLogStream =
    env.OTEL_EXPORTER_OTLP_ENDPOINT === undefined ? undefined : await createLogShipper(config.name);

  const metricsExport =
    env.OTEL_EXPORTER_OTLP_ENDPOINT === undefined
      ? undefined
      : await startMetricsShipper(config.name);

  const logger = createLogger({
    level: env.LOG_LEVEL,
    name: config.name,
    ...(otlpLogStream !== undefined && { stream: otlpLogStream }),
  });

  const keySet = parseServiceJWKS(env.SERVICE_AUTH_JWKS);

  const app = new Elysia();

  if (env.OTEL_EXPORTER_OTLP_ENDPOINT !== undefined) {
    const [{ opentelemetry }, { OTLPTraceExporter }, { buildTelemetryResource }] =
      await Promise.all([
        import('@elysiajs/opentelemetry'),
        import('@opentelemetry/exporter-trace-otlp-proto'),
        import('@vers/service-utils/otel'),
      ]);

    // constructed bare so the exporter derives its full configuration from the standard
    // `OTEL_EXPORTER_OTLP_*` environment variables: the base endpoint gains the per-signal path,
    // and shared plus per-signal headers (backend auth, dataset routing) merge from env
    app.use(
      opentelemetry({
        checkIfShouldTrace: shouldTraceRequest,
        resource: buildTelemetryResource({ serviceName: config.name }),
        serviceName: config.name,
        traceExporter: new OTLPTraceExporter(),
      }),
    );
  }

  // registered after the OTel plugin: the OpenTelemetry API keeps only the first global tracer
  // provider, context manager, and propagator per process, so going second makes the Sentry SDK's
  // own OTel bootstrap a no-op; reversed, its sentry-trace-only propagator would shadow traceparent
  await startErrorReporting(env.SENTRY_DSN);

  const router = await config.buildRouter({ env, logger });

  app.get('/health', (context) => {
    const trace = createTrace(context.request);

    context.set.headers['x-trace-id'] = trace.traceID;

    return { service: config.name, status: 'ok' };
  });

  const handler = new RPCHandler(router, {
    clientInterceptors: [
      onError((thrown) => {
        // A declared contract error or any other 4xx is the caller's problem, already encoded by
        // the wire layer; only genuinely unexpected failures are logged and reported.
        if (thrown instanceof ORPCError && (thrown.defined || thrown.status < 500)) {
          return;
        }

        logger.error({ err: thrown }, 'unexpected service error');

        reportUnexpectedError(thrown);
      }),
    ],
  });

  registerORPCHandler(app, '/rpc', handler, {
    keySet,
    logger,
    serviceName: config.name,
    slowRequestMs: config.slowRequestMs ?? DEFAULT_SLOW_REQUEST_MS,
    ...(config.slowRequestOverridesMs !== undefined && {
      slowRequestOverridesMs: config.slowRequestOverridesMs,
    }),
  });

  return {
    app,
    env,
    listen: (port?: number) => {
      app.listen(port ?? env.PORT);
      logger.info(`${config.name} listening on port ${app.server?.port ?? port ?? env.PORT}`);
    },
    logger,
    stopTelemetry: async () => {
      await Promise.all([metricsExport?.stop(), otlpLogStream?.flush()]);
    },
  };
}

function parseServiceEnv<TEnvShape extends z.ZodRawShape>(
  envShape: TEnvShape,
): ServiceEnv<TEnvShape> {
  const base = baseEnvSchema.safeParse(process.env);
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

async function startMetricsShipper(serviceName: string): Promise<MetricsExport> {
  const otelModule = await import('@vers/service-utils/otel');

  return otelModule.startMetricsExport({ serviceName });
}

async function createLogShipper(serviceName: string): Promise<OTLPLogStream> {
  const otelModule = await import('@vers/service-utils/otel');

  return otelModule.createOTLPLogStream({ serviceName });
}

function createTrace(request: Request): TraceContext {
  return (
    findSpanTraceContext() ??
    createTraceContext(parseTraceparent(request.headers.get('traceparent')) ?? undefined)
  );
}

interface RegisterORPCHandlerDeps {
  readonly keySet: ServiceKeySet;
  readonly logger: pino.Logger;
  readonly serviceName: string;
  readonly slowRequestMs: number;
  readonly slowRequestOverridesMs?: Readonly<Record<string, number>>;
}

function registerORPCHandler(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- elysia app is a live framework instance with mutable routing state; no readonly form
  app: Elysia,
  prefix: `/${string}`,
  handler: FetchHandler<ServiceContext>,
  deps: RegisterORPCHandlerDeps,
): void {
  app.all(
    `${prefix}*`,
    (context) => {
      const trace = createTrace(context.request);

      return withTraceContext(trace, async () => {
        const start = performance.now();
        const method = context.request.method;

        // pathname only: a GET-mapped procedure encodes its input in the query string, and logged
        // inputs belong to the handler's own lines, not the transport's
        const path = new URL(context.request.url).pathname;

        const resolution = await parseServiceToken(context.request, {
          audience: deps.serviceName,
          keySet: deps.keySet,
        });

        if ('failure' in resolution) {
          const response = Response.json({ error: resolution.failure }, { status: 401 });

          response.headers.set('x-trace-id', trace.traceID);

          deps.logger.warn(
            {
              durationMs: toDurationMs(performance.now() - start),
              failure: resolution.failure,
              method,
              path,
              status: 401,
            },
            'service token rejected',
          );

          return response;
        }

        let handled: Awaited<ReturnType<typeof handler.handle>>;

        try {
          handled = await handler.handle(context.request, {
            context: {
              actingSessionID: resolution.actingSessionID,
              actingUserID: resolution.actingUserID,
              logger: deps.logger,
              traceID: trace.traceID,
            },
            prefix,
          });
        } catch (error) {
          deps.logger.error(
            { durationMs: toDurationMs(performance.now() - start), err: error, method, path },
            'request failed',
          );

          throw error;
        }

        const finalResponse = handled.matched
          ? handled.response
          : new Response('not found', { status: 404 });

        finalResponse.headers.set('x-trace-id', trace.traceID);

        const elapsedMs = performance.now() - start;
        const durationMs = toDurationMs(elapsedMs);
        const thresholdMs = deps.slowRequestOverridesMs?.[path] ?? deps.slowRequestMs;
        const isSlow = elapsedMs > thresholdMs && finalResponse.status < 500;

        deps.logger[isSlow ? 'warn' : pickRequestLogLevel(finalResponse.status)](
          {
            durationMs,
            method,
            path,
            status: finalResponse.status,
            ...(isSlow && { slow: true, thresholdMs }),
          },
          'request completed',
        );

        return finalResponse;
      });
    },
    { parse: 'none' },
  );
}

function pickRequestLogLevel(status: number): 'error' | 'info' | 'warn' {
  if (status >= 500) {
    return 'error';
  }

  return status >= 400 ? 'warn' : 'info';
}

function toDurationMs(elapsedMs: number): number {
  return Math.round(elapsedMs * 10) / 10;
}
