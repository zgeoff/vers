import { expect, test } from 'bun:test';
import { createLogger } from './create-logger';

test('it writes each entry to the extra stream as a JSON line', () => {
  const lines: Array<string> = [];

  const logger = createLogger({
    level: 'info',
    stream: {
      write: (line: string) => {
        lines.push(line);
      },
    },
  });

  logger.info({ requestID: 'r1' }, 'served');

  expect(lines).toHaveLength(1);
  expect(JSON.parse(lines[0] ?? '')).toMatchObject({ level: 30, msg: 'served', requestID: 'r1' });
});

test('it keeps entries below the configured level out of the extra stream', () => {
  const lines: Array<string> = [];

  const logger = createLogger({
    level: 'info',
    stream: {
      write: (line: string) => {
        lines.push(line);
      },
    },
  });

  logger.debug('quiet');

  expect(lines).toBeEmpty();
});
