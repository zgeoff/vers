import { expect, test } from 'bun:test';
import {
  createActivityChainRow,
  createActivityRow,
  createAvatarRow,
  createTestDB,
  createTestUser,
} from '@vers/service-test-utils/bun';
import { readChainAnchorChecks } from './read-chain-anchor-checks';

async function setupTest() {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it finds no violation when each active activity starts at its chain’s appended anchor', async () => {
  await using ctx = await setupTest();

  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityChainRow(ctx.db, {
    appendedChainIndex: 6,
    avatarId: avatar.id,
    scopeId: '2_3',
    verifiedChainIndex: 4,
  });

  await createActivityRow(ctx.db, {
    appendedHead: 6,
    avatarId: avatar.id,
    id: 'act_exited',
    scopeId: '2_3',
    startChainIndex: 0,
    status: 'stopped',
    verifiedHead: 4,
  });

  await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    id: 'act_running',
    scopeId: '2_3',
    startChainIndex: 6,
  });

  const checks = await readChainAnchorChecks(ctx.db);

  expect(checks).toStrictEqual([
    {
      area: 'chain-anchors',
      name: 'the verified anchor sits at or behind the appended anchor',
      violations: [],
    },
    {
      area: 'chain-anchors',
      name: 'an active activity starts at its chain’s appended anchor',
      violations: [],
    },
    { area: 'chain-anchors', name: 'every activity has its chain', violations: [] },
  ]);
});

test('it reports a chain whose verified anchor sits past its appended anchor', async () => {
  await using ctx = await setupTest();

  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityChainRow(ctx.db, {
    appendedChainIndex: 3,
    avatarId: avatar.id,
    scopeId: '2_3',
    verifiedChainIndex: 5,
  });

  const checks = await readChainAnchorChecks(ctx.db);

  expect(checks[0]).toStrictEqual({
    area: 'chain-anchors',
    name: 'the verified anchor sits at or behind the appended anchor',
    violations: [`chain ${avatar.id}/world_map_node/2_3`],
  });
});

test('it reports an active activity that starts away from its chain’s appended anchor', async () => {
  await using ctx = await setupTest();

  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityChainRow(ctx.db, {
    appendedChainIndex: 2,
    avatarId: avatar.id,
    scopeId: '2_3',
  });

  await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    id: 'act_ahead',
    scopeId: '2_3',
    startChainIndex: 9,
  });

  const checks = await readChainAnchorChecks(ctx.db);

  expect(checks[1]).toStrictEqual({
    area: 'chain-anchors',
    name: 'an active activity starts at its chain’s appended anchor',
    violations: ['activity act_ahead'],
  });
});

test('it reports an activity whose chain is missing', async () => {
  await using ctx = await setupTest();

  const user = await createTestUser(ctx.db);
  const avatar = await createAvatarRow(ctx.db, { userId: user.user.id });

  await createActivityRow(ctx.db, {
    avatarId: avatar.id,
    id: 'act_orphaned',
    scopeId: '2_3',
    status: 'stopped',
  });

  const checks = await readChainAnchorChecks(ctx.db);

  expect(checks[2]).toStrictEqual({
    area: 'chain-anchors',
    name: 'every activity has its chain',
    violations: ['activity act_orphaned'],
  });
});
