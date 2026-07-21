import { expect, mock, test } from 'bun:test';
import { logger } from './logger';

test('it never invokes the message thunk when debug logging is disabled', () => {
  const buildMessage = mock(() => 'unreachable');

  logger.debug(buildMessage);

  expect(buildMessage).not.toHaveBeenCalled();
});
