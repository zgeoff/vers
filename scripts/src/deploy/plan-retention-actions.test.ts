import { expect, test } from 'bun:test';
import { createMockSimVersionRow } from '@vers/sim-registry/test-utils';
import { planRetentionActions } from './plan-retention-actions';

const ENGINE_HASH = 'a1b2c3d4e5f6'.padEnd(64, '0');

test('it plans a provider-app destroy for each tombstoned row', () => {
  const row = createMockSimVersionRow({ engineHash: ENGINE_HASH });
  const actions = planRetentionActions([row]);

  expect(actions).toStrictEqual([
    { app: 'vers-replay-a1b2c3d4e5f6', kind: 'destroy-provider-app' },
  ]);
});

test('it plans one action per row, in the same order', () => {
  const first = createMockSimVersionRow({ engineHash: ENGINE_HASH });

  const second = createMockSimVersionRow({
    engineHash: 'b2c3d4e5f6a1'.padEnd(64, '0'),
  });

  const actions = planRetentionActions([first, second]);

  expect(actions).toStrictEqual([
    { app: 'vers-replay-a1b2c3d4e5f6', kind: 'destroy-provider-app' },
    { app: 'vers-replay-b2c3d4e5f6a1', kind: 'destroy-provider-app' },
  ]);
});

test('it plans nothing for an empty tombstoned set', () => {
  const actions = planRetentionActions([]);

  expect(actions).toBeEmpty();
});
