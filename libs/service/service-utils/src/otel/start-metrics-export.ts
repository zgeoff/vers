import { metrics } from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { readTelemetryResource } from './read-telemetry-resource';

interface StartMetricsExportOptions {
  readonly serviceName: string;
}

export interface MetricsExport {
  readonly stop: () => Promise<void>;
}

export function startMetricsExport(options: StartMetricsExportOptions): MetricsExport {
  const provider = new MeterProvider({
    // the exporter reads its endpoint and headers from OTEL_EXPORTER_OTLP_* at construction, so
    // callers gate on those being present
    readers: [new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter() })],
    resource: readTelemetryResource({ serviceName: options.serviceName }),
  });

  metrics.setGlobalMeterProvider(provider);

  return { stop: () => provider.shutdown() };
}
