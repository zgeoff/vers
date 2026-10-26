import type { AnyRouter } from '@orpc/server';
import { ORPCError, onError } from '@orpc/server';
import type { FetchHandler } from '@orpc/server/fetch';
import { RPCHandler } from '@orpc/server/fetch';
import type { ServiceKeySet, TokenIssuer } from '@vers/service-auth';
import { parseServiceJWKS, verifyServiceToken } from '@vers/service-auth';
import { findSpanTraceContext, withRootSpan, withTraceContext } from '@vers/service-utils';
import type { MetricsExport } from '@vers/service-utils/otel';
import type { TraceContext } from '@vers/trace';
import { createTraceContext, parseTraceparent } from '@vers/trace';
import { Elysia } from 'elysia';
import * as z from 'zod';
import { baseEnvSchema } from './base-env-schema';
import { createResourceScope } from './create-resource-scope';
import { flushErrorReports } from './flush-error-reports';
import type { Logger } from './logging';
import { configureLogging } from './logging/configure-logging';
import type { OTLPLogSink } from './logging/create-otlp-log-sink';
import { recordCallerRejection } from './metrics/record-caller-rejection';
import { reportUnexpectedError } from './report-unexpected-error';
import { shouldTraceRequest } from './should-trace-request';
import { startErrorReporting } from './start-error-reporting';
import type { DisposableResourceScope, ResourceScope, ServiceContext } from './types';

type ServiceEnv<TEnvShape extends z.ZodRawShape> = z.infer<typeof baseEnvSchema> &
  z.infer<z.ZodObject<TEnvShape>>;

interface ServiceRuntime<TEnvShape extends z.ZodRawShape> {
  readonly env: Readonly<ServiceEnv<TEnvShape>>;
  readonly logger: Logger;
}

export interface ServiceConfig<TEnvShape extends z.ZodRawShape, TResources> {
  readonly allowedIssuers: ReadonlyArray<TokenIssuer>;
  readonly createRouter: (
    runtime: ServiceRuntime<TEnvShape>,
    resources: TResources,
  ) => AnyRouter | Promise<AnyRouter>;
  readonly envShape: TEnvShape;
  readonly name: string;
  readonly onBoot?: (resources: TResources) => Promise<unknown>;
  readonly overdueRequestMs?: number;
  readonly resources: (
    runtime: ServiceRuntime<TEnvShape>,
    scope: ResourceScope,
  ) => Promise<TResources> | TResources;
  readonly slowRequestMs?: number;
  readonly slowRequestOverridesMs?: Readonly<Record<string, number>>;
}

export interface ServeOptions {
  readonly exit?: (code: number) => void;
  readonly port?: number;
}

export interface Service<TEnvShape extends z.ZodRawShape, TResources> {
  readonly app: Elysia;
  readonly env: ServiceEnv<TEnvShape>;
  readonly logger: Logger;
  readonly resources: TResources;
  readonly serve: (options?: ServeOptions) => void;
  readonly stop: () => Promise<void>;
}

const DEFAULT_SLOW_REQUEST_MS = 2000;
const DEFAULT_OVERDUE_REQUEST_MS = 30_000;

// Fly stops a machine with SIGINT unless its config sets another kill signal; compose and a
// container runtime send SIGTERM
const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const;

export async function createService<
  TEnvShape extends z.ZodRawShape = Record<string, never>,
  TResources = Record<string, never>,
>(config: ServiceConfig<TEnvShape, TResources>): Promise<Service<TEnvShape, TResources>> {
  const env = readServiceEnv(config.envShape);
  const scope = createResourceScope();

  // ahead of the OTel plugin: the OpenTelemetry API keeps the first global context manager, and
  // only Sentry's gives each request its own scope; the plugin's own registration then no-ops
  await startErrorReporting(env.SENTRY_DSN);

  const otlpLogSink =
    env.OTEL_EXPORTER_OTLP_ENDPOINT === undefined
      ? undefined
      : await createLogShipper(config.name, scope);

  if (env.OTEL_EXPORTER_OTLP_ENDPOINT !== undefined) {
    await startMetricsShipper(config.name, scope);
  }

  const logger = configureLogging({
    category: config.name,
    format: 'json',
    level: env.LOG_LEVEL,
    ...(otlpLogSink !== undefined && { sinks: [otlpLogSink.sink] }),
  });

  const keySet = parseServiceJWKS(env.SERVICE_AUTH_JWKS);

  const app = new Elysia();

  if (env.OTEL_EXPORTER_OTLP_ENDPOINT !== undefined) {
    const [{ opentelemetry }, { OTLPTraceExporter }, { readTelemetryResource }] = await Promise.all(
      [
        import('@elysiajs/opentelemetry'),
        import('@opentelemetry/exporter-trace-otlp-proto'),
        import('@vers/service-utils/otel'),
      ],
    );

    // constructed bare so the exporter derives its full configuration from the standard
    // `OTEL_EXPORTER_OTLP_*` environment variables: the base endpoint gains the per-signal path,
    // and shared plus per-signal headers (backend auth, dataset routing) merge from env
    app.use(
      opentelemetry({
        checkIfShouldTrace: shouldTraceRequest,
        resource: readTelemetryResource({ serviceName: config.name }),
        serviceName: config.name,
        traceExporter: new OTLPTraceExporter(),
      }),
    );
  }

  const runtime: ServiceRuntime<TEnvShape> = { env, logger };

  const acquired = await acquireResources(config, runtime, scope);

  app.get('/health', (context) => {
    const trace = createTrace(context.request);

    context.set.headers['x-trace-id'] = trace.traceID;

    return { service: config.name, status: 'ok' };
  });

  const handler = new RPCHandler(acquired.router, {
    clientInterceptors: [
      onError((thrown) => {
        // A declared contract error or any other 4xx is the caller's outcome, already encoded by
        // the wire layer: logged so Axiom can group a refusal by its cause, never reported. Only a
        // declared error's data is logged, since only a contract keeps that shape free of secrets.
        if (thrown instanceof ORPCError && (thrown.defined || thrown.status < 500)) {
          logger.warn('request refused', {
            code: thrown.code,
            status: thrown.status,
            ...(thrown.defined && { data: thrown.data }),
          });

          return;
        }

        logger.error('unexpected service error', { error: thrown });

        reportUnexpectedError(thrown);
      }),
    ],
  });

  registerORPCHandler(app, '/rpc', handler, {
    allowedIssuers: config.allowedIssuers,
    keySet,
    logger,
    serviceName: config.name,
    overdueRequestMs: config.overdueRequestMs ?? DEFAULT_OVERDUE_REQUEST_MS,
    slowRequestMs: config.slowRequestMs ?? DEFAULT_SLOW_REQUEST_MS,
    ...(config.slowRequestOverridesMs !== undefined && {
      slowRequestOverridesMs: config.slowRequestOverridesMs,
    }),
  });

  let stopping: Promise<void> | undefined;
  let bootWork: Promise<void> = Promise.resolve();
  let exit: (code: number) => void = exitProcess;

  const handleShutdownSignal = (): void => {
    void runShutdown({ exit, logger, stop });
  };

  const stop = (): Promise<void> => {
    stopping ??= stopService({ app, bootWork, handleShutdownSignal, scope });

    return stopping;
  };

  return {
    app,
    env,
    logger,
    resources: acquired.resources,
    serve: (options = {}) => {
      exit = options.exit ?? exit;

      app.listen(options.port ?? env.PORT);
      logger.info(`${config.name} listening on port ${app.server?.port ?? env.PORT}`);

      for (const signal of SHUTDOWN_SIGNALS) {
        process.once(signal, handleShutdownSignal);
      }

      if (config.onBoot !== undefined) {
        bootWork = runBootWork(config.onBoot, acquired.resources, logger);
      }
    },
    stop,
  };
}

function readServiceEnv<TEnvShape extends z.ZodRawShape>(
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

async function createLogShipper(serviceName: string, scope: ResourceScope): Promise<OTLPLogSink> {
  const logSinkModule = await import('./logging/create-otlp-log-sink');

  const sink = logSinkModule.createOTLPLogSink({ serviceName });

  return scope.adopt(sink, (adopted) => adopted.flush());
}

async function startMetricsShipper(
  serviceName: string,
  scope: ResourceScope,
): Promise<MetricsExport> {
  const otelModule = await import('@vers/service-utils/otel');

  const metricsExport = otelModule.startMetricsExport({ serviceName });

  return scope.adopt(metricsExport, (adopted) => adopted.stop());
}

interface AcquiredResources<TResources> {
  readonly resources: TResources;
  readonly router: AnyRouter;
}

async function acquireResources<TEnvShape extends z.ZodRawShape, TResources>(
  config: ServiceConfig<TEnvShape, TResources>,
  runtime: ServiceRuntime<TEnvShape>,
  scope: DisposableResourceScope,
): Promise<AcquiredResources<TResources>> {
  try {
    const resources = await config.resources(runtime, scope);
    const router = await config.createRouter(runtime, resources);

    return { resources, router };
  } catch (error) {
    return disposeAfterFailure(
      scope,
      error,
      'service boot failed, and its resources failed to stop',
    );
  }
}

async function disposeAfterFailure(
  scope: DisposableResourceScope,
  failure: unknown,
  message: string,
): Promise<never> {
  try {
    await scope.dispose();
  } catch (error) {
    throw new AggregateError([failure, error], message, { cause: error });
  }

  throw failure;
}

function createTrace(request: Request): TraceContext {
  return (
    findSpanTraceContext() ??
    createTraceContext(parseTraceparent(request.headers.get('traceparent')) ?? undefined)
  );
}

interface RegisterORPCHandlerDeps {
  readonly allowedIssuers: ReadonlyArray<TokenIssuer>;
  readonly keySet: ServiceKeySet;
  readonly logger: Logger;
  readonly overdueRequestMs: number;
  readonly serviceName: string;
  readonly slowRequestMs: number;
  readonly slowRequestOverridesMs?: Readonly<Record<string, number>>;
}

function registerORPCHandler(
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
        const method = context.request.method;

        // pathname only: a GET-mapped procedure encodes its input in the query string, and logged
        // inputs belong to the handler's own lines, not the transport's
        const path = new URL(context.request.url).pathname;

        // written while the request is still open: a span exports only once it ends, so a request
        // that never finishes leaves this line as its only trace
        const overdue = setTimeout(() => {
          deps.logger.warn('request overdue', { elapsedMs: deps.overdueRequestMs, method, path });
        }, deps.overdueRequestMs);

        try {
          return await serveORPCRequest({
            request: context.request,
            handler,
            deps,
            trace,
            route: { method, path, prefix },
          });
        } finally {
          clearTimeout(overdue);
        }
      });
    },
    { parse: 'none' },
  );
}

interface RequestRoute {
  readonly method: string;
  readonly path: string;
  readonly prefix: `/${string}`;
}

interface ServeORPCRequestOptions {
  readonly request: Request;
  readonly handler: FetchHandler<ServiceContext>;
  readonly deps: RegisterORPCHandlerDeps;
  readonly trace: Readonly<TraceContext>;
  readonly route: Readonly<RequestRoute>;
}

async function serveORPCRequest(options: ServeORPCRequestOptions): Promise<Response> {
  const handler = options.handler;
  const deps = options.deps;
  const trace = options.trace;
  const method = options.route.method;
  const path = options.route.path;
  const start = performance.now();

  const resolution = await verifyServiceToken(options.request, {
    audience: deps.serviceName,
    keySet: deps.keySet,
  });

  if ('failure' in resolution) {
    const response = Response.json({ error: resolution.failure }, { status: 401 });

    response.headers.set('x-trace-id', trace.traceID);

    deps.logger.warn('service token rejected', {
      durationMs: toDurationMs(performance.now() - start),
      failure: resolution.failure,
      method,
      path,
      status: 401,
    });

    return response;
  }

  if (!deps.allowedIssuers.includes(resolution.issuer)) {
    recordCallerRejection({ issuer: resolution.issuer, service: deps.serviceName });

    const response = Response.json({ error: 'issuer-not-permitted' }, { status: 403 });

    response.headers.set('x-trace-id', trace.traceID);

    deps.logger.warn('service caller rejected', {
      durationMs: toDurationMs(performance.now() - start),
      issuer: resolution.issuer,
      method,
      path,
      status: 403,
    });

    return response;
  }

  let handled: Awaited<ReturnType<typeof handler.handle>>;

  try {
    handled = await handler.handle(options.request, {
      context: {
        actingSessionID: resolution.actingSessionID,
        actingUserID: resolution.actingUserID,
        issuer: resolution.issuer,
        logger: deps.logger,
        traceID: trace.traceID,
      },
      prefix: options.route.prefix,
    });
  } catch (error) {
    deps.logger.error('request failed', {
      durationMs: toDurationMs(performance.now() - start),
      error,
      method,
      path,
    });

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

  deps.logger[isSlow ? 'warn' : pickRequestLogLevel(finalResponse.status)]('request completed', {
    durationMs,
    method,
    path,
    status: finalResponse.status,
    ...(isSlow && { slow: true, thresholdMs }),
  });

  return finalResponse;
}

function toDurationMs(elapsedMs: number): number {
  return Math.round(elapsedMs * 10) / 10;
}

function pickRequestLogLevel(status: number): 'error' | 'info' | 'warn' {
  if (status >= 500) {
    return 'error';
  }

  return status >= 400 ? 'warn' : 'info';
}

function exitProcess(code: number): void {
  process.exit(code);
}

interface RunShutdownInput {
  readonly exit: (code: number) => void;
  readonly logger: Logger;
  readonly stop: () => Promise<void>;
}

// the try/catch lives inside the trace scope so a shutdown report still carries its trace id
function runShutdown(input: RunShutdownInput): Promise<void> {
  return withTraceContext(createTraceContext(), async () => {
    let exitCode = 0;

    try {
      await input.stop();
    } catch (error) {
      input.logger.error('graceful shutdown failed', { error });

      reportUnexpectedError(error);

      exitCode = 1;
    }

    const flushed = await flushErrorReports();

    if (!flushed) {
      input.logger.warn('error reports were still queued when the flush timed out');
    }

    input.exit(exitCode);
  });
}

interface StopServiceInput {
  readonly app: Elysia;
  readonly bootWork: Promise<void>;
  readonly handleShutdownSignal: () => void;
  readonly scope: DisposableResourceScope;
}

async function stopService(input: StopServiceInput): Promise<void> {
  for (const signal of SHUTDOWN_SIGNALS) {
    process.off(signal, input.handleShutdownSignal);
  }

  try {
    if (input.app.server !== null) {
      await input.app.stop();
    }

    await input.bootWork;
  } catch (error) {
    return disposeAfterFailure(
      input.scope,
      error,
      'service stop failed, and its resources failed to stop',
    );
  }

  await input.scope.dispose();
}

// boot work never delays the listen, and its failure is reported inside its own root span
function runBootWork<TResources>(
  onBoot: (resources: TResources) => Promise<unknown>,
  resources: TResources,
  logger: Logger,
): Promise<void> {
  return withRootSpan('service.boot', async () => {
    try {
      await onBoot(resources);
    } catch (error) {
      logger.error('boot work failed', { error });

      reportUnexpectedError(error);
    }
  });
}
