import { metrics } from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { buildTelemetryResource } from './build-telemetry-resource';

interface StartMetricsExportOptions {
  readonly serviceName: string;
}

export interface MetricsExport {
  readonly stop: () => Promise<void>;
}

/**
 * Registers the global meter provider behind a periodic OTLP exporter. The exporter reads the
 * standard `OTEL_EXPORTER_OTLP_*` environment variables at construction for its endpoint and
 * headers, so callers gate on those being present. Instruments created through the OpenTelemetry
 * metrics API anywhere in the process export through this provider — without the registration
 * they stay the API's no-ops. `stop` flushes the final collection and releases the reader's
 * periodic timer, which otherwise keeps the event loop alive.
 */
export function startMetricsExport(options: StartMetricsExportOptions): MetricsExport {
  const provider = new MeterProvider({
    readers: [new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter() })],
    resource: buildTelemetryResource({ serviceName: options.serviceName }),
  });

  metrics.setGlobalMeterProvider(provider);

  return { stop: () => provider.shutdown() };
}
