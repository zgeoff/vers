import { expect, test } from 'bun:test';
import { NodeSeedSchema } from './node-seed-schema';

const wellFormed = {
  avatarID: 'avatar-a',
  contentVersion: '1',
  encounterNode: { difficulty: 3 },
  genesisSeed: 'seed-a',
  head: { chainIndex: 0, nextSeed: 'seed-a' },
  nodeID: '1_0',
};

test('it accepts a well-formed node seed', () => {
  const result = NodeSeedSchema.safeParse(wellFormed);

  expect(result.success).toBeTrue();
});

test('it rejects a row missing head', () => {
  const { head: _head, ...withoutHead } = wellFormed;
  const result = NodeSeedSchema.safeParse(withoutHead);

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['head'] }));
});

test('it rejects a row whose encounterNode fails its own schema', () => {
  const result = NodeSeedSchema.safeParse({
    ...wellFormed,
    encounterNode: { difficulty: 'not-a-number' },
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['encounterNode', 'difficulty'] }),
  );
});
