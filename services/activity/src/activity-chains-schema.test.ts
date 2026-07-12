import { expect, test } from 'bun:test';
import { faker } from '@faker-js/faker';
import { createTestDB, createTestUser } from '@vers/service-test-utils/bun';
import { createAvatarRow } from './test-utils/create-avatar-row';

test('it round-trips an activity_chains row', async () => {
  await using db = await createTestDB();

  const testUser = await createTestUser(db.db);
  const avatar = await createAvatarRow(db.db, { userId: testUser.user.id });

  const genesisSeed = faker.string.hexadecimal({ casing: 'lower', length: 32, prefix: '' });
  const appendedNextSeed = faker.string.hexadecimal({ casing: 'lower', length: 32, prefix: '' });
  const verifiedNextSeed = faker.string.hexadecimal({ casing: 'lower', length: 32, prefix: '' });

  const inserted = await db.db
    .insertInto('activityChains')
    .values({
      appendedNextSeed,
      avatarId: avatar.id,
      genesisSeed,
      nodeId: 'node_1',
      verifiedNextSeed,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const selected = await db.db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', avatar.id)
    .where('nodeId', '=', 'node_1')
    .executeTakeFirstOrThrow();

  expect(selected).toStrictEqual(inserted);
  expect(selected.appendedChainIndex).toBe(0);
  expect(selected.verifiedChainIndex).toBe(0);
  expect(selected.genesisSeed).toBe(genesisSeed);
  expect(selected.appendedNextSeed).toBe(appendedNextSeed);
  expect(selected.verifiedNextSeed).toBe(verifiedNextSeed);
  expect(selected.createdAt).toBeInstanceOf(Date);
});
