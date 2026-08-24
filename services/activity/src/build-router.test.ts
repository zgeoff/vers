import { expect, test } from 'bun:test';
import { activityContract } from '@vers/contract-activity';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { collectConformanceCases } from '@vers/test-utils';
import { createActivityService } from './create-activity-service';

async function setupTest() {
  const db = await createTestDB();
  const service = await createActivityService({ db: db.db });

  return { app: service.app, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it passes every conformance case collected from its contract', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-activity' });

  const cases = collectConformanceCases(activityContract, {
    anonymousHeaders: { authorization: `Bearer ${viewer.token}` },
    authedSamples: {
      getCurrentActivity: { avatarID: 'x' },
      getLatestActivityProgress: { avatarID: 'x' },
      getRevealedNodes: {
        avatarID: 'x',
        viewport: { maxCX: 0, maxCY: 0, minCX: 0, minCY: 0 },
      },
      stopActivity: { avatarID: 'x' },
      trackActivityProgress: { activityID: 'x', checkpoints: [], expectedHead: 0 },
    },
  });

  for (const conformanceCase of cases) {
    await expect(conformanceCase.run(ctx.app)).toResolve();
  }
});
