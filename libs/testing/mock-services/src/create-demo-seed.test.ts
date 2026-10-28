import { expect, test } from 'bun:test';
import { createDemoSeed } from './create-demo-seed';
import { MOCK_CURRENT_CONTENT_VERSION, contentDocumentCollection } from './db';

test('it publishes the current content version, which a node start reads before any activity exists', async () => {
  await createDemoSeed();

  expect(
    contentDocumentCollection.findFirst((query) =>
      query.where({ contentVersion: MOCK_CURRENT_CONTENT_VERSION }),
    )?.contentVersion,
  ).toBe(MOCK_CURRENT_CONTENT_VERSION);
});
