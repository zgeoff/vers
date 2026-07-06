import { expect, test } from 'bun:test';
import { setupTest } from './setup-test';

// Each call acquires its own transaction-isolated handle from the same shared worker database
// (`@vers/service-test-utils/bun`'s default isolation). These two tests prove the rollback
// actually holds across test boundaries — order-dependent by design.

test('it creates an avatar visible within this test', async () => {
  await using ctx = await setupTest();
  const client = await ctx.client();

  await client.createAvatar({ class: 'brute', name: 'IsolationProof' });

  const rows = await ctx.db.selectFrom('avatars').selectAll().execute();

  expect(rows).toHaveLength(1);
});

test('it starts with no avatars left over from the previous test', async () => {
  await using ctx = await setupTest();

  const rows = await ctx.db.selectFrom('avatars').selectAll().execute();

  expect(rows).toBeEmpty();
});
