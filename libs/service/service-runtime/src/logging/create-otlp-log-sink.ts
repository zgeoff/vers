import type { Sink } from '@logtape/logtape';
import { getOpenTelemetrySink } from '@logtape/otel';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { readTelemetryResource } from '@vers/service-utils/otel';

interface CreateOTLPLogSinkOptions {
  readonly serviceName: string;
}

export interface OTLPLogSink {
  readonly flush: () => Promise<void>;
  readonly sink: Sink;
}

export function createOTLPLogSink(options: CreateOTLPLogSinkOptions): OTLPLogSink {
  // a provider of our own rather than the sink's built-in one: the built-in exports each record in
  // its own request, and it would carry a resource apart from the one traces and metrics share
  const provider = new LoggerProvider({
    processors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })],
    resource: readTelemetryResource({ serviceName: options.serviceName }),
  });

  return {
    flush: () => provider.forceFlush(),
    sink: getOpenTelemetrySink({ loggerProvider: provider }),
  };
}
