import { expect, test } from 'bun:test';
import { NodeSeedSchema } from './node-seed-schema';

test('it accepts a well-formed node seed', () => {
  const result = NodeSeedSchema.safeParse({
    avatarID: 'avatar-a',
    contentVersion: '1',
    encounterNode: { difficulty: 3 },
    genesisSeed: 'seed-a',
    anchor: { chainIndex: 0, nextSeed: 'seed-a' },
    nodeID: '1_0',
  });

  expect(result.success).toBeTrue();
});

test('it rejects a row missing anchor', () => {
  const result = NodeSeedSchema.safeParse({
    avatarID: 'avatar-a',
    contentVersion: '1',
    encounterNode: { difficulty: 3 },
    genesisSeed: 'seed-a',
    nodeID: '1_0',
  });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['anchor'] }));
});

test('it rejects a row whose encounterNode fails its own schema', () => {
  const result = NodeSeedSchema.safeParse({
    avatarID: 'avatar-a',
    contentVersion: '1',
    encounterNode: { difficulty: 'not-a-number' },
    genesisSeed: 'seed-a',
    anchor: { chainIndex: 0, nextSeed: 'seed-a' },
    nodeID: '1_0',
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['encounterNode', 'difficulty'] }),
  );
});
