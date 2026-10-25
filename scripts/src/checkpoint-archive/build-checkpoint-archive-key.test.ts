import { expect, test } from 'bun:test';
import { buildCheckpointArchiveKey } from './build-checkpoint-archive-key';

test('it keys an archive by avatar and activity', () => {
  expect(buildCheckpointArchiveKey('avatar_key', 'act_key')).toBe(
    'checkpoints/avatar_key/act_key.jsonl.gz',
  );
});

test('it encodes a slash in an id, so the id stays one key segment', () => {
  expect(buildCheckpointArchiveKey('avatar_key', 'run/1')).toBe(
    'checkpoints/avatar_key/run%2F1.jsonl.gz',
  );
});
