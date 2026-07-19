import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { buildLogRecord } from './build-log-record';
import { buildTelemetryResource } from './build-telemetry-resource';
import { isRecord } from './is-record';

interface CreateOTLPLogStreamOptions {
  readonly serviceName: string;
}

export interface OTLPLogStream {
  readonly flush: () => Promise<void>;
  readonly write: (line: string) => void;
}

/**
 * Builds a pino destination that re-emits every line as an OpenTelemetry log record over OTLP.
 * The exporter reads the standard `OTEL_EXPORTER_OTLP_*` environment variables at construction
 * for its endpoint and headers, so callers gate on those being present. Records batch for up to a
 * second before export — a hard process kill can drop the final batch; `flush` forces a drain.
 */
export function createOTLPLogStream(options: CreateOTLPLogStreamOptions): OTLPLogStream {
  const provider = new LoggerProvider({
    processors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })],
    resource: buildTelemetryResource({ serviceName: options.serviceName }),
  });

  const otelLogger = provider.getLogger(options.serviceName);

  return {
    flush: () => provider.forceFlush(),
    write: (lines) => {
      for (const line of lines.split('\n')) {
        if (line === '') {
          continue;
        }

        // a line the logger cannot re-emit must never take down the process it observes
        try {
          const parsed: unknown = JSON.parse(line);

          if (isRecord(parsed)) {
            otelLogger.emit(buildLogRecord(parsed));
          }
        } catch {
          // swallowed by design: stdout still carries the original line
        }
      }
    },
  };
}
