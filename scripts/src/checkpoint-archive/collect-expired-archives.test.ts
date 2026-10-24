import { expect, test } from 'bun:test';
import { collectExpiredArchives } from './collect-expired-archives';

test('it collects an archive written before the cutoff', () => {
  expect(
    collectExpiredArchives(
      [{ key: 'checkpoints/avatar_a/act_old.jsonl.gz', lastModified: '2026-01-01T00:00:00.000Z' }],
      new Date('2026-04-01T00:00:00.000Z'),
    ),
  ).toStrictEqual([{ activityID: 'act_old', key: 'checkpoints/avatar_a/act_old.jsonl.gz' }]);
});

test('it skips an archive written at or after the cutoff', () => {
  expect(
    collectExpiredArchives(
      [{ key: 'checkpoints/avatar_a/act_new.jsonl.gz', lastModified: '2026-04-01T00:00:00.000Z' }],
      new Date('2026-04-01T00:00:00.000Z'),
    ),
  ).toStrictEqual([]);
});

test('it never collects an object outside the archive key layout', () => {
  expect(
    collectExpiredArchives(
      [
        { key: 'checkpoints/notes.txt', lastModified: '2026-01-01T00:00:00.000Z' },
        {
          key: 'checkpoints/avatar_a/nested/act.jsonl.gz',
          lastModified: '2026-01-01T00:00:00.000Z',
        },
      ],
      new Date('2026-04-01T00:00:00.000Z'),
    ),
  ).toStrictEqual([]);
});
