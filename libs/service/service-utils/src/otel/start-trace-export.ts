import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { BatchSpanProcessor, NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { buildTelemetryResource } from './build-telemetry-resource';

interface StartTraceExportOptions {
  readonly serviceName: string;
}

export interface TraceExport {
  readonly stop: () => Promise<void>;
}

/**
 * Registers the global tracer provider behind a batched OTLP exporter, for a runtime with no
 * framework-level OTel plugin (app-web; services keep the `@elysiajs/opentelemetry` plugin path).
 * The exporter reads the standard `OTEL_EXPORTER_OTLP_*` environment variables at construction for
 * its endpoint and headers, so callers gate on those being present. `register()` with no
 * arguments installs the default `AsyncLocalStorageContextManager` and W3C trace-context
 * propagator, so a span opened anywhere in the process stays active across awaits and its context
 * propagates over outbound `traceparent` headers. `stop` flushes the final batch and releases the
 * processor's periodic timer, which otherwise keeps the event loop alive.
 */
export function startTraceExport(options: StartTraceExportOptions): TraceExport {
  const provider = new NodeTracerProvider({
    resource: buildTelemetryResource({ serviceName: options.serviceName }),
    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
  });

  provider.register();

  return { stop: () => provider.shutdown() };
}
