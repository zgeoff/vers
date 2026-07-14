import { expect, test } from 'bun:test';
import type { SimVersionRow } from '@vers/sim-registry';
import { planRetentionActions } from './plan-retention-actions';

const ENGINE_HASH = 'a1b2c3d4e5f6'.padEnd(64, '0');

function buildTombstonedRow(overrides: Partial<SimVersionRow> = {}): SimVersionRow {
  return {
    bunVersion: '1.3.10',
    createdAt: new Date('2026-01-01'),
    deployedAt: new Date('2026-01-01'),
    engineHash: ENGINE_HASH,
    imageRef: 'registry.fly.io/vers-service-replay@sha256:pruned',
    providerUrl: 'http://vers-replay-a1b2c3d4e5f6.flycast',
    retainedUntil: new Date('2026-02-01'),
    status: 'pruned',
    ...overrides,
  };
}

test('it plans a provider-app destroy for each tombstoned row', () => {
  const actions = planRetentionActions([buildTombstonedRow()]);

  expect(actions).toStrictEqual([
    { app: 'vers-replay-a1b2c3d4e5f6', kind: 'destroy-provider-app' },
  ]);
});

test('it plans one action per row, in the same order', () => {
  const second = buildTombstonedRow({ engineHash: 'b2c3d4e5f6a1'.padEnd(64, '0') });
  const actions = planRetentionActions([buildTombstonedRow(), second]);

  expect(actions).toStrictEqual([
    { app: 'vers-replay-a1b2c3d4e5f6', kind: 'destroy-provider-app' },
    { app: 'vers-replay-b2c3d4e5f6a1', kind: 'destroy-provider-app' },
  ]);
});

test('it plans nothing for an empty tombstoned set', () => {
  const actions = planRetentionActions([]);

  expect(actions).toBeEmpty();
});
