import { expect, onTestFinished, test } from 'bun:test';
import type { LogRecord } from '@logtape/logtape';
import { resetSync } from '@logtape/logtape';
import { withTraceContext } from '@vers/service-utils';
import { createTraceContext } from '@vers/trace';
import { configureLogging } from './configure-logging';

test('it hands each sink the entry with its level, category and fields', () => {
  const records: Array<LogRecord> = [];

  const logger = configureLogging({
    category: 'test-service',
    format: 'json',
    level: 'info',
    sinks: [
      (record) => {
        records.push(record);
      },
    ],
  });

  onTestFinished(() => {
    resetSync();
  });

  logger.warn('request refused', { code: 'NOT_FOUND', status: 404 });

  expect(records).toHaveLength(1);

  expect(records[0]).toMatchObject({
    category: ['test-service'],
    level: 'warning',
    properties: { code: 'NOT_FOUND', status: 404 },
    rawMessage: 'request refused',
  });
});

test('it stamps the active trace id onto each entry', () => {
  const records: Array<LogRecord> = [];

  const logger = configureLogging({
    category: 'test-service',
    format: 'json',
    level: 'info',
    sinks: [
      (record) => {
        records.push(record);
      },
    ],
  });

  onTestFinished(() => {
    resetSync();
  });

  const trace = createTraceContext();

  withTraceContext(trace, () => {
    logger.info('listening');
  });

  expect(records[0]?.properties).toStrictEqual({ traceID: trace.traceID });
});

test('it keeps entries below the configured level out of the sinks', () => {
  const records: Array<LogRecord> = [];

  const logger = configureLogging({
    category: 'test-service',
    format: 'json',
    level: 'warn',
    sinks: [
      (record) => {
        records.push(record);
      },
    ],
  });

  onTestFinished(() => {
    resetSync();
  });

  logger.info('quiet');

  expect(records).toBeEmpty();
});
