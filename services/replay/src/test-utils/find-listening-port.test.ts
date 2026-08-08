import { expect, test } from 'bun:test';
import { findListeningPort } from './find-listening-port';

test('it reads the bound port from a boot log line', () => {
  const line =
    '{"level":30,"time":1,"pid":1,"hostname":"h","name":"service-replay-provider","msg":"service-replay-provider listening on port 41123"}';

  expect(findListeningPort(line)).toBe(41_123);
});

test('it misses on a line without a port announcement', () => {
  expect(findListeningPort('{"level":30,"msg":"request completed"}')).toBeUndefined();
});
