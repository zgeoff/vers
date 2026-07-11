import { expect, test } from 'bun:test';
import { createLogger } from './create-logger';

test('it writes each entry to the extra stream with the service name bound', () => {
  const lines: Array<string> = [];

  const logger = createLogger({
    level: 'info',
    name: 'test-service',
    stream: {
      write: (line: string) => {
        lines.push(line);
      },
    },
  });

  logger.info('listening');

  expect(lines).toHaveLength(1);

  expect(JSON.parse(lines[0] ?? '')).toMatchObject({
    level: 30,
    msg: 'listening',
    name: 'test-service',
  });
});

test('it keeps entries below the configured level out of the extra stream', () => {
  const lines: Array<string> = [];

  const logger = createLogger({
    level: 'warn',
    name: 'test-service',
    stream: {
      write: (line: string) => {
        lines.push(line);
      },
    },
  });

  logger.info('quiet');

  expect(lines).toBeEmpty();
});
