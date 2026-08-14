import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import type { ClientContext } from '@orpc/client';
import type { StandardLinkClientInterceptorOptions } from '@orpc/client/standard';
import type { Interceptor } from '@orpc/shared';
import type { StandardLazyResponse } from '@orpc/standard-server';
import { buildTraceparent, createTraceContext } from '@vers/trace';
import { findSpanTraceContext } from '../trace/find-span-trace-context';
import { findTraceContext } from '../trace/find-trace-context';

/**
 * Builds an `RPCLink` `clientInterceptors` entry that mints a CLIENT span per call (named by the
 * procedure's path) and injects the outbound `traceparent`. A 5xx response or a thrown transport
 * failure marks the span failed before it rethrows.
 */
export function buildTracingInterceptor<T extends ClientContext = ClientContext>(): Interceptor<
  StandardLinkClientInterceptorOptions<T>,
  Promise<StandardLazyResponse>
> {
  return (options) => {
    const tracer = trace.getTracer('@vers/service-utils');

    return tracer.startActiveSpan(
      options.path.join('.'),
      { kind: SpanKind.CLIENT },
      async (span) => {
        // Prefers the span's own trace context, falls back to the ambient request's, and mints
        // fresh only when neither exists (background work with no request scope).
        const outboundTrace = findSpanTraceContext() ?? findTraceContext() ?? createTraceContext();

        options.request.headers['traceparent'] = buildTraceparent(outboundTrace);

        try {
          const response = await options.next();

          if (response.status >= 500) {
            span.setStatus({ code: SpanStatusCode.ERROR });
          }

          return response;
        } catch (error) {
          const exception = error instanceof Error ? error : String(error);

          span.recordException(exception);
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  };
}
