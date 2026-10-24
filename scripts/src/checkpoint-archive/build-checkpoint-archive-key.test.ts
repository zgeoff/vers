import { expect, test } from 'bun:test';
import { buildCheckpointArchiveKey } from './build-checkpoint-archive-key';

test('it keys an archive by avatar and activity', () => {
  expect(buildCheckpointArchiveKey('avatar_key', 'act_key')).toBe(
    'checkpoints/avatar_key/act_key.jsonl.gz',
  );
});
