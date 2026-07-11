import { expect, test } from 'bun:test';
import { buildLogRecord } from './build-log-record';

test('it maps a pino line onto body, severity, timestamp, and attributes', () => {
  const record = buildLogRecord({
    level: 30,
    msg: 'listening on port 3000',
    name: 'test-service',
    time: 1_752_192_000_000,
    traceID: 'abc123',
  });

  expect(record).toStrictEqual({
    attributes: { name: 'test-service', traceID: 'abc123' },
    body: 'listening on port 3000',
    severityNumber: 9,
    severityText: 'info',
    timestamp: 1_752_192_000_000,
  });
});

test('it maps each pino level to the matching severity', () => {
  expect(buildLogRecord({ level: 10 })).toMatchObject({ severityNumber: 1, severityText: 'trace' });
  expect(buildLogRecord({ level: 20 })).toMatchObject({ severityNumber: 5, severityText: 'debug' });
  expect(buildLogRecord({ level: 40 })).toMatchObject({ severityNumber: 13, severityText: 'warn' });

  expect(buildLogRecord({ level: 50 })).toMatchObject({
    severityNumber: 17,
    severityText: 'error',
  });

  expect(buildLogRecord({ level: 60 })).toMatchObject({
    severityNumber: 21,
    severityText: 'fatal',
  });
});

test('it reports a line without a recognised level as info', () => {
  expect(buildLogRecord({ msg: 'bare' })).toMatchObject({
    severityNumber: 9,
    severityText: 'info',
  });

  expect(buildLogRecord({ level: 35, msg: 'custom' })).toMatchObject({
    severityNumber: 9,
    severityText: 'info',
  });
});

test('it omits the timestamp when the line carries no time', () => {
  expect(buildLogRecord({ level: 30, msg: 'no clock' })).not.toContainKey('timestamp');
});
