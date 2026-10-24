import { expect, onTestFinished, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import postgres from 'postgres';
import { applyMigrations } from './apply-migrations';
import { contentDocumentV2 } from './content-seed/content-document-v2';
import { createDB } from './create-db';
import { removeTestDatabase } from './test-support/remove-test-database';
import { resolveTestDBTarget } from './test-support/resolve-test-db-target';

async function setupTest() {
  const baseURI = resolveTestDBTarget().baseURI;
  const dbName = `test_${createId()}`;
  const setupClient = postgres(`${baseURI}/postgres`);

  await setupClient.unsafe(`CREATE DATABASE ${dbName}`);
  await setupClient.end();

  const databaseURL = `${baseURI}/${dbName}`;

  onTestFinished(() => removeTestDatabase(databaseURL));

  return { databaseURL };
}

test('it applies pending migrations once and is a no-op the second time', async () => {
  const ctx = await setupTest();
  const first = await applyMigrations({ databaseURL: ctx.databaseURL });

  expect(first.error).toBeUndefined();
  expect(first.results).not.toBeEmpty();

  const second = await applyMigrations({ databaseURL: ctx.databaseURL });

  expect(second.error).toBeUndefined();
  expect(second.results).toBeEmpty();
});

test('it creates the pending_transactions table with defaults applied', async () => {
  const ctx = await setupTest();

  await applyMigrations({ databaseURL: ctx.databaseURL });

  const db = createDB({ databaseURL: ctx.databaseURL });

  const inserted = await db
    .insertInto('pendingTransactions')
    .values({
      action: 'test-action',
      expiresAt: new Date(Date.now() + 60_000),
      id: 'ptx_test',
      ipAddress: '127.0.0.1',
      target: 'test-target',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  expect(inserted.attempts).toBe(0);
  expect(inserted.sessionId).toBeNull();
  expect(inserted.createdAt).toBeInstanceOf(Date);

  await db.destroy();
});

test('it creates the activity_chains table with both chain indexes starting at zero', async () => {
  const ctx = await setupTest();

  await applyMigrations({ databaseURL: ctx.databaseURL });

  const db = createDB({ databaseURL: ctx.databaseURL });

  onTestFinished(() => db.destroy());

  await db
    .insertInto('users')
    .values({ email: 'chains@example.com', id: 'usr_chains', name: 'Chains', username: 'chains' })
    .execute();

  await db
    .insertInto('avatars')
    .values({ id: 'avt_chains', name: 'Chains', userId: 'usr_chains' })
    .execute();

  const inserted = await db
    .insertInto('activityChains')
    .values({
      appendedNextSeed: '22222222222222222222222222222222',
      avatarId: 'avt_chains',
      genesisSeed: '11111111111111111111111111111111',
      scopeId: 'node_1',
      scopeType: 'world_map_node',
      verifiedNextSeed: '33333333333333333333333333333333',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const selected = await db
    .selectFrom('activityChains')
    .selectAll()
    .where('avatarId', '=', 'avt_chains')
    .where('scopeType', '=', 'world_map_node')
    .where('scopeId', '=', 'node_1')
    .executeTakeFirstOrThrow();

  expect(selected).toStrictEqual(inserted);
  expect(selected.appendedChainIndex).toBe(0);
  expect(selected.verifiedChainIndex).toBe(0);
  expect(selected.genesisSeed).toBe('11111111111111111111111111111111');
  expect(selected.appendedNextSeed).toBe('22222222222222222222222222222222');
  expect(selected.verifiedNextSeed).toBe('33333333333333333333333333333333');
  expect(selected.createdAt).toBeInstanceOf(Date);
});

test('it adds the consumed-transaction-token table and audit columns', async () => {
  const ctx = await setupTest();

  await applyMigrations({ databaseURL: ctx.databaseURL });

  const db = createDB({ databaseURL: ctx.databaseURL });

  const token = await db
    .insertInto('consumedTransactionTokens')
    .values({ expiresAt: new Date(Date.now() + 60_000), jti: 'jti_test' })
    .returningAll()
    .executeTakeFirstOrThrow();

  expect(token.jti).toBe('jti_test');
  expect(token.createdAt).toBeInstanceOf(Date);

  await db
    .insertInto('users')
    .values({ email: 'cols@example.com', id: 'usr_cols', name: 'Cols', username: 'cols' })
    .execute();

  const session = await db
    .insertInto('sessions')
    .values({
      expiresAt: new Date(Date.now() + 60_000),
      id: 'ses_cols',
      ipAddress: '127.0.0.1',
      userId: 'usr_cols',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  expect(session.previousRefreshToken).toBeNull();

  const verification = await db
    .insertInto('verifications')
    .values({
      algorithm: 'SHA-256',
      charSet: '0123456789',
      digits: 6,
      id: 'ver_cols',
      period: 30,
      secret: 'secret',
      target: 'cols@example.com',
      type: '2fa',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  expect(verification.lastVerifiedCode).toBeNull();
  expect(verification.lastVerifiedAt).toBeNull();

  await db.destroy();
});

test('it bumps updated_at through the set_updated_at trigger on update', async () => {
  const ctx = await setupTest();

  await applyMigrations({ databaseURL: ctx.databaseURL });

  const db = createDB({ databaseURL: ctx.databaseURL });

  const staleDate = new Date('2020-01-01T00:00:00.000Z');

  const inserted = await db
    .insertInto('users')
    .values({
      createdAt: staleDate,
      email: 'trigger@example.com',
      id: 'usr_trigger',
      name: 'Trigger',
      updatedAt: staleDate,
      username: 'trigger',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const updated = await db
    .updateTable('users')
    .set({ name: 'Trigger Updated' })
    .where('id', '=', 'usr_trigger')
    .returningAll()
    .executeTakeFirstOrThrow();

  expect(updated.updatedAt).toBeAfter(inserted.updatedAt);

  await db.destroy();
});

test('it seeds both content versions and points current at the newest', async () => {
  const ctx = await setupTest();

  await applyMigrations({ databaseURL: ctx.databaseURL });

  const db = createDB({ databaseURL: ctx.databaseURL });

  const versions = await db.selectFrom('contentVersions').select('contentVersion').execute();

  expect(versions.map((row) => row.contentVersion)).toIncludeSameMembers(['1', '2']);

  const current = await db.selectFrom('contentCurrent').selectAll().executeTakeFirstOrThrow();

  expect(current.contentVersion).toBe('2');

  const v2Row = await db
    .selectFrom('contentVersions')
    .selectAll()
    .where('contentVersion', '=', '2')
    .executeTakeFirstOrThrow();

  expect(v2Row.document).toStrictEqual(contentDocumentV2);

  await db.destroy();
});

test('it refuses to update a content_versions row', async () => {
  const ctx = await setupTest();

  await applyMigrations({ databaseURL: ctx.databaseURL });

  const db = createDB({ databaseURL: ctx.databaseURL });

  expect(
    db
      .updateTable('contentVersions')
      .set({ document: { nonsense: true } })
      .where('contentVersion', '=', '1')
      .execute(),
  ).rejects.toThrowWithMessage(Error, /immutable/u);

  await db.destroy();
});

test('it refuses to delete a content_versions row', async () => {
  const ctx = await setupTest();

  await applyMigrations({ databaseURL: ctx.databaseURL });

  const db = createDB({ databaseURL: ctx.databaseURL });

  expect(
    db.deleteFrom('contentVersions').where('contentVersion', '=', '1').execute(),
  ).rejects.toThrowWithMessage(Error, /immutable/u);

  await db.destroy();
});
