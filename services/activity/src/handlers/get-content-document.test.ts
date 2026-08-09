import { expect, test } from 'bun:test';
import type { ActivityContract } from '@vers/contract-activity';
import { ContentDocumentSchema } from '@vers/contract-activity';
import { contentDocumentV1, contentDocumentV2 } from '@vers/db';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createActivityService } from '../create-activity-service';

async function setupTest() {
  const db = await createTestDB();
  const service = await createActivityService({ db: db.db });

  return { app: service.app, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it returns the seeded v2 document', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-activity' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const document = await client.getContentDocument({ contentVersion: '2' });

  expect(document).toStrictEqual(ContentDocumentSchema.parse(contentDocumentV2));
});

test('it returns the seeded v1 document', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-activity' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  const document = await client.getContentDocument({ contentVersion: '1' });

  expect(document).toStrictEqual(ContentDocumentSchema.parse(contentDocumentV1));
});

test('it rejects an unknown content version', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-activity' });

  const client = buildRPCTestClient<ActivityContract>(ctx.app, { token: viewer.token });

  expect(client.getContentDocument({ contentVersion: 'nope' })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});
