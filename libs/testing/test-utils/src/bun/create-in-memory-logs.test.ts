import { expect, test } from 'bun:test';
import { getLogger } from '@logtape/logtape';
import { createInMemoryLogs } from './create-in-memory-logs';

test('it records each entry with its level, category, message and properties', () => {
  const logs = createInMemoryLogs({ lowestLevel: 'info' });

  getLogger(['test-memory']).warn('disk nearly full', { freeBytes: 512 });

  expect(logs.records).toHaveLength(1);

  expect(logs.records[0]).toMatchObject({
    category: ['test-memory'],
    level: 'warning',
    properties: { freeBytes: 512 },
    rawMessage: 'disk nearly full',
  });
});

test('it keeps entries below the lowest level out of the records', () => {
  const logs = createInMemoryLogs({ lowestLevel: 'warning' });

  getLogger(['test-memory']).info('routine tick');

  expect(logs.records).toBeEmpty();
});
