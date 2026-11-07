import { context, propagation, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { BatchSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import { readTelemetryResource } from './read-telemetry-resource';

interface StartTraceExportOptions {
  readonly serviceName: string;
}

export interface TraceExport {
  readonly stop: () => Promise<void>;
}

export function startTraceExport(options: StartTraceExportOptions): TraceExport {
  // the exporter reads its endpoint and headers from OTEL_EXPORTER_OTLP_* at construction, so
  // callers gate on those being present
  const provider = new TracerProvider({
    resource: readTelemetryResource({ serviceName: options.serviceName }),
    spanProcessors: [new BatchSpanProcessor({ exporter: new OTLPTraceExporter() })],
  });

  trace.setGlobalTracerProvider(provider);
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());

  propagation.setGlobalPropagator(
    new CompositePropagator({
      propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
    }),
  );

  return { stop: () => provider.shutdown() };
}
