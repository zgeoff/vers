import { expect, test } from 'bun:test';
import { collectConformanceCases } from '@vers/contract-base/test-utils';
import { userContract } from '@vers/contract-user';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { createUserService } from './create-user-service';

async function setupTest() {
  const db = await createTestDB();
  const { app } = await createUserService({ db: db.db });

  return { app, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it passes every conformance case collected from its contract', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-user' });

  const cases = collectConformanceCases(userContract, {
    anonymousHeaders: { authorization: `Bearer ${token}` },
    authedSamples: {
      changePassword: { password: 'ConformancePassw0rd' },
      getCurrentUser: {},
      updateEmail: { email: 'conformance@example.com' },
      updateUser: { name: 'ConformanceName' },
    },
  });

  for (const conformanceCase of cases) {
    await expect(conformanceCase.run(ctx.app)).toResolve();
  }
});
