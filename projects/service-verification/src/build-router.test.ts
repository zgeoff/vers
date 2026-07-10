import { expect, test } from 'bun:test';
import { verificationContract } from '@vers/contract-verification';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { collectConformanceCases } from '@vers/test-utils';
import { createVerificationService } from './create-verification-service';

async function setupTest() {
  const db = await createTestDB();
  const service = await createVerificationService({ db: db.db });

  return { app: service.app, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it passes every conformance case collected from its contract', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-verification' });

  const cases = collectConformanceCases(verificationContract, {
    anonymousHeaders: { authorization: `Bearer ${viewer.token}` },
  });

  for (const conformanceCase of cases) {
    await expect(conformanceCase.run(ctx.app)).toResolve();
  }
});
