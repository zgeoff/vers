import { onTestFinished } from 'bun:test';
import type { LogLevel, LogRecord } from '@logtape/logtape';
import { configureSync, resetSync } from '@logtape/logtape';

interface CreateInMemoryLogsOptions {
  readonly lowestLevel: LogLevel;
}

interface InMemoryLogs {
  readonly records: ReadonlyArray<LogRecord>;
}

export function createInMemoryLogs(options: CreateInMemoryLogsOptions): InMemoryLogs {
  const records: Array<LogRecord> = [];

  configureSync({
    loggers: [
      { category: [], lowestLevel: options.lowestLevel, sinks: ['memory'] },
      { category: ['logtape', 'meta'], lowestLevel: 'warning' },
    ],
    reset: true,
    sinks: {
      memory: (record) => {
        records.push(record);
      },
    },
  });

  onTestFinished(() => {
    resetSync();
  });

  return { records };
}
