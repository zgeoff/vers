import { expect, test } from 'bun:test';
import { createContentVersion } from '@vers/content-registry';
import type { ActivityContract } from '@vers/contract-activity';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createActivityService } from '../create-activity-service';

// `createContentVersion` opens its own interactive transaction, which the default
// transaction-isolation handle can't nest — this suite publishes in-test, so it runs against a
// real, committed schema clone.
async function setupTest() {
  const db = await createTestDB({ isolation: 'schema' });
  const service = await createActivityService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it returns a published document', async () => {
  await using ctx = await setupTest();

  const document = createMockContentDocument();

  await createContentVersion(ctx.db, document);

  const viewer = await createAnonymousViewer({ audience: 'service-activity' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(
    client.getContentDocument({ contentVersion: document.contentVersion }),
  ).resolves.toStrictEqual(document);
});

test('it rejects an unknown content version', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-activity' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(client.getContentDocument({ contentVersion: 'nope' })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});
