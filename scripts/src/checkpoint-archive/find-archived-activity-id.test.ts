import { expect, test } from 'bun:test';
import { findArchivedActivityID } from './find-archived-activity-id';

test.each([
  ['checkpoints/avatar_a/act_found.jsonl.gz', 'act_found'],
  ['checkpoints/avatar_a/run%2F1.jsonl.gz', 'run/1'],
  ['checkpoints/avatar_a/run%E0%A4.jsonl.gz', undefined],
  ['checkpoints/act_found.jsonl.gz', undefined],
  ['checkpoints/avatar_a/act_found.jsonl', undefined],
  ['other/avatar_a/act_found.jsonl.gz', undefined],
])('it reads the activity id of %s as %s', (key, expected) => {
  expect(findArchivedActivityID(key)).toBe(expected);
});
