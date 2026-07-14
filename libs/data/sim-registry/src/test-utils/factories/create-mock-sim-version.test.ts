import { expect, test } from 'bun:test';
import { createMockSimVersion } from './create-mock-sim-version';

test('it builds a default active sim version row', () => {
  const row = createMockSimVersion();

  expect(row).toStrictEqual({
    bunVersion: expect.toBeString(),
    engineHash: expect.toBeString(),
    imageRef: expect.toBeString(),
    providerUrl: expect.toBeString(),
    retainedUntil: expect.toBeValidDate(),
    status: 'active',
  });
});

test('it applies overrides on top of the defaults', () => {
  const row = createMockSimVersion({ engineHash: 'hash_1', status: 'pruned' });

  expect(row).toStrictEqual({
    bunVersion: expect.toBeString(),
    engineHash: 'hash_1',
    imageRef: expect.toBeString(),
    providerUrl: expect.toBeString(),
    retainedUntil: expect.toBeValidDate(),
    status: 'pruned',
  });
});
