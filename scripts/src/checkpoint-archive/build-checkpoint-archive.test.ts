import { expect, test } from 'bun:test';
import { buildCheckpointArchive } from './build-checkpoint-archive';

test('it writes one JSON line per row, in row order', () => {
  const archive = buildCheckpointArchive([
    {
      activityId: 'act_lines',
      appendedAt: new Date('2026-01-01T00:00:01.000Z'),
      hash: 'hash_1',
      payload: { type: 'started' },
      prevHash: 'hash_0',
      version: 1,
    },
    {
      activityId: 'act_lines',
      appendedAt: new Date('2026-01-01T00:00:02.000Z'),
      hash: 'hash_2',
      payload: { type: 'completed' },
      prevHash: 'hash_1',
      version: 2,
    },
  ]);

  expect(new TextDecoder().decode(Bun.gunzipSync(archive))).toMatchInlineSnapshot(`
    "{"activityId":"act_lines","appendedAt":"2026-01-01T00:00:01.000Z","hash":"hash_1","payload":{"type":"started"},"prevHash":"hash_0","version":1}
    {"activityId":"act_lines","appendedAt":"2026-01-01T00:00:02.000Z","hash":"hash_2","payload":{"type":"completed"},"prevHash":"hash_1","version":2}
    "
  `);
});

test('it builds equal bytes for equal rows', () => {
  expect(
    buildCheckpointArchive([
      {
        activityId: 'act_same',
        appendedAt: new Date('2026-01-01T00:00:01.000Z'),
        hash: 'hash_1',
        payload: {},
        prevHash: 'hash_0',
        version: 1,
      },
    ]),
  ).toStrictEqual(
    buildCheckpointArchive([
      {
        activityId: 'act_same',
        appendedAt: new Date('2026-01-01T00:00:01.000Z'),
        hash: 'hash_1',
        payload: {},
        prevHash: 'hash_0',
        version: 1,
      },
    ]),
  );
});
