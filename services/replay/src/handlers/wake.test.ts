import { expect, test } from 'bun:test';
import { createContentVersion } from '@vers/content-registry';
import { ContentDocumentSchema } from '@vers/contract-activity';
import type { ReplayContract } from '@vers/contract-replay';
import { contentDocumentV2 } from '@vers/db';
import { buildStateFromSeed } from '@vers/game-utils';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createReplayService } from '../create-replay-service';
import { createHonestActivityFixture } from '../test-utils/create-honest-activity-fixture';

async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });

  await createContentVersion(db.db, ContentDocumentSchema.parse(contentDocumentV2));

  const service = await createReplayService({ db: db.db });
  const viewer = await createAnonymousViewer({ audience: 'service-replay' });

  return {
    client: buildRPCTestClient<ReplayContract>(service.app, { token: viewer.token }),
    db: db.db,
    [Symbol.asyncDispose]: db[Symbol.asyncDispose],
  };
}

test('it returns drained: 0 against an idle queue', async () => {
  await using ctx = await setupTest();

  expect(ctx.client.wake({})).resolves.toStrictEqual({ drained: 0 });
});

test('it drains a seeded backlog and reports how many chains it claimed', async () => {
  await using ctx = await setupTest();

  await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  expect(ctx.client.wake({})).resolves.toStrictEqual({ drained: 1 });
});
