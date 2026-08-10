import { expect, test } from 'bun:test';
import { createMockSimVersionRow } from './create-mock-sim-version-row';

test('it builds a default active sim version row', () => {
  const row = createMockSimVersionRow();

  expect(row).toStrictEqual({
    bunVersion: expect.toBeString(),
    createdAt: expect.toBeValidDate(),
    deployedAt: expect.toBeValidDate(),
    engineHash: expect.toBeString(),
    imageRef: expect.toBeString(),
    maxContentVersion: '999999999',
    providerUrl: expect.toBeString(),
    retainedUntil: expect.toBeValidDate(),
    status: 'active',
  });
});

test('it applies overrides on top of the defaults', () => {
  const row = createMockSimVersionRow({ engineHash: 'hash_1', status: 'pruned' });

  expect(row).toStrictEqual({
    bunVersion: expect.toBeString(),
    createdAt: expect.toBeValidDate(),
    deployedAt: expect.toBeValidDate(),
    engineHash: 'hash_1',
    imageRef: expect.toBeString(),
    maxContentVersion: '999999999',
    providerUrl: expect.toBeString(),
    retainedUntil: expect.toBeValidDate(),
    status: 'pruned',
  });
});
