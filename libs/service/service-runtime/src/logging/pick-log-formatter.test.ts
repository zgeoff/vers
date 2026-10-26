import { expect, test } from 'bun:test';
import { pickLogFormatter } from './pick-log-formatter';

test('it renders each property beside the message in the pretty format', () => {
  const line = pickLogFormatter('pretty')({
    category: ['test-service'],
    level: 'warning',
    message: ['request refused'],
    properties: { refusalCode: 'NOT_FOUND' },
    rawMessage: 'request refused',
    timestamp: 0,
  });

  expect(line).toIncludeMultiple(['request refused', 'refusalCode', 'NOT_FOUND']);
});

test('it flattens each property into the JSON line in the json format', () => {
  const line = pickLogFormatter('json')({
    category: ['test-service'],
    level: 'warning',
    message: ['request refused'],
    properties: { refusalCode: 'NOT_FOUND' },
    rawMessage: 'request refused',
    timestamp: 0,
  });

  expect(JSON.parse(line)).toStrictEqual({
    '@timestamp': '1970-01-01T00:00:00.000Z',
    level: 'WARN',
    logger: 'test-service',
    message: 'request refused',
    refusalCode: 'NOT_FOUND',
  });
});
