import type { LogLevel, Logger, Sink, TextFormatter } from '@logtape/logtape';
import {
  ansiColorFormatter,
  configureSync,
  getJsonLinesFormatter,
  getLogger,
} from '@logtape/logtape';
import { findTraceContext } from '@vers/service-utils';

type ServiceLogLevel = 'debug' | 'error' | 'fatal' | 'info' | 'trace' | 'warn';

interface ConfigureLoggingOptions {
  readonly category: string;
  readonly format: 'json' | 'pretty';
  readonly level: ServiceLogLevel;
  readonly sinks?: ReadonlyArray<Sink>;
}

export function configureLogging(options: ConfigureLoggingOptions): Logger {
  const formatter =
    options.format === 'pretty'
      ? ansiColorFormatter
      : getJsonLinesFormatter({ properties: 'flatten' });

  const sinks = Object.fromEntries(
    [makeStdoutSink(formatter), ...(options.sinks ?? [])].map((sink, index) => [
      `sink-${index}`,
      makeTraceStampedSink(sink),
    ]),
  );

  configureSync({
    loggers: [
      { category: [], lowestLevel: toLogTapeLevel(options.level), sinks: Object.keys(sinks) },

      // LogTape announces its own configuration on its meta logger at info on every configure
      { category: ['logtape', 'meta'], lowestLevel: 'warning' },
    ],
    reset: true,
    sinks,
  });

  return getLogger([options.category]);
}

function makeStdoutSink(formatter: TextFormatter): Sink {
  return (record) => {
    process.stdout.write(formatter(record));
  };
}

function makeTraceStampedSink(sink: Sink): Sink {
  return (record) => {
    const trace = findTraceContext();

    const stamped =
      trace === undefined
        ? record
        : { ...record, properties: { traceID: trace.traceID, ...record.properties } };

    sink(stamped);
  };
}

function toLogTapeLevel(level: ServiceLogLevel): LogLevel {
  return level === 'warn' ? 'warning' : level;
}
