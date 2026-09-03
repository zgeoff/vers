import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { BatchSpanProcessor, NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { buildTelemetryResource } from './build-telemetry-resource';

interface StartTraceExportOptions {
  readonly serviceName: string;
}

export interface TraceExport {
  readonly stop: () => Promise<void>;
}

export function startTraceExport(options: StartTraceExportOptions): TraceExport {
  const provider = new NodeTracerProvider({
    resource: buildTelemetryResource({ serviceName: options.serviceName }),
    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
  });

  // register() with no arguments installs the default AsyncLocalStorage context manager and the W3C
  // trace-context propagator; the exporter read its endpoint and headers from OTEL_EXPORTER_OTLP_*
  // at construction, so callers gate on those being present
  provider.register();

  return { stop: () => provider.shutdown() };
}
