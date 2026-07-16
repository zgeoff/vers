import { expect, test } from 'bun:test';
import type { DB } from '@vers/db';
import { createTestDB } from '@vers/service-test-utils/bun';
import type { Kysely } from 'kysely';
import { recordRelease } from './record-release';

async function setupTest(): Promise<{ db: Kysely<DB> } & AsyncDisposable> {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it appends a row and returns it with generated fields filled', async () => {
  await using ctx = await setupTest();

  const row = await recordRelease(ctx.db, {
    app: 'vers-app-web',
    gitSHA: 'abc123',
    image: 'registry.fly.io/vers-app-web:deployment-abc123',
    imageDigest: 'sha256:feed',
  });

  expect(row).toStrictEqual({
    app: 'vers-app-web',
    deployedAt: expect.toBeValidDate(),
    gitSha: 'abc123',
    id: expect.toBeString(),
    image: 'registry.fly.io/vers-app-web:deployment-abc123',
    imageDigest: 'sha256:feed',
  });
});

test('it accepts a null image digest', async () => {
  await using ctx = await setupTest();

  const row = await recordRelease(ctx.db, {
    app: 'vers-bugsink',
    gitSHA: 'abc123',
    image: 'registry.fly.io/vers-bugsink:v1',
    imageDigest: null,
  });

  expect(row.imageDigest).toBeNull();
});

test('it never collapses repeat rollouts of the same sha into one row', async () => {
  await using ctx = await setupTest();

  const input = {
    app: 'vers-app-web',
    gitSHA: 'abc123',
    image: 'registry.fly.io/vers-app-web:deployment-abc123',
    imageDigest: null,
  };

  const first = await recordRelease(ctx.db, input);
  const second = await recordRelease(ctx.db, input);

  expect(second.id).not.toBe(first.id);
});
