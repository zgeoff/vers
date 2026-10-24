import { expect, test } from 'bun:test';
import { parseCheckpointArchive } from './parse-checkpoint-archive';

test('it parses each JSON line into a checkpoint row', () => {
  const archive = Bun.gzipSync(
    '{"activityId":"act_parse","appendedAt":"2026-01-01T00:00:01.000Z","hash":"hash_1","payload":{"type":"started"},"prevHash":"hash_0","version":1}\n',
  );

  expect(parseCheckpointArchive(archive)).toStrictEqual([
    {
      activityId: 'act_parse',
      appendedAt: new Date('2026-01-01T00:00:01.000Z'),
      hash: 'hash_1',
      payload: { type: 'started' },
      prevHash: 'hash_0',
      version: 1,
    },
  ]);
});

test('it rejects a line with a fractional version', () => {
  const archive = Bun.gzipSync(
    '{"activityId":"act_parse","appendedAt":"2026-01-01T00:00:01.000Z","hash":"hash_1","payload":{"type":"started"},"prevHash":"hash_0","version":1.5}\n',
  );

  expect(() => parseCheckpointArchive(archive)).toThrow();
});
