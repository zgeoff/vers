import { expect, test } from 'bun:test';
import { avatarContract } from '@vers/contract-avatar';
import { collectConformanceCases } from '@vers/contract-base/test-utils';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { createAvatarService } from './create-avatar-service';

async function setupTest() {
  const db = await createTestDB();
  const service = await createAvatarService({ db: db.db });

  return { app: service.app, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it passes every conformance case collected from its contract', async () => {
  await using ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-avatar' });

  const cases = collectConformanceCases(avatarContract, {
    anonymousHeaders: { authorization: `Bearer ${viewer.token}` },
    authedSamples: {
      createAvatar: { class: 'brute', name: 'Conformance' },
      deleteAvatar: { id: 'x' },
      getAvatar: { id: 'x' },
      getAvatars: {},
      updateAvatar: { id: 'x', name: 'ConformanceTwo' },
    },
  });

  for (const conformanceCase of cases) {
    await expect(conformanceCase.run(ctx.app)).toResolve();
  }
});
