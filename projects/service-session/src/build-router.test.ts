import { expect, test } from 'bun:test';
import { collectConformanceCases } from '@vers/contract-base/test-utils';
import { sessionContract } from '@vers/contract-session';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { createSessionService } from './create-session-service';

async function setupTest() {
  const db = await createTestDB();
  const { app } = await createSessionService({ db: db.db });

  return { app, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it passes every conformance case collected from its contract', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-session' });

  const cases = collectConformanceCases(sessionContract, {
    anonymousHeaders: { authorization: `Bearer ${token}` },
    authedSamples: {
      deleteSession: { id: 'x' },
      getSession: { id: 'x' },
      getSessions: {},
    },
  });

  for (const conformanceCase of cases) {
    await expect(conformanceCase.run(ctx.app)).toResolve();
  }
});
