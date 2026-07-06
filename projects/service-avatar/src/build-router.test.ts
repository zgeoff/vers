import { expect, test } from 'bun:test';
import { avatarContract } from '@vers/contract-avatar';
import { collectConformanceCases } from '@vers/contract-base/test-utils';
import { createServiceToken } from '@vers/service-runtime/test-utils';
import { getTestServiceKeyPair } from '@vers/service-test-utils/bun';
import { setupTest } from './test-utils/setup-test';

test('it passes every conformance case collected from its contract', async () => {
  await using ctx = await setupTest();
  const { privateKey } = await getTestServiceKeyPair();
  const anonymousToken = await createServiceToken({ audience: 'service-avatar', privateKey });

  const cases = collectConformanceCases(avatarContract, {
    anonymousHeaders: { authorization: `Bearer ${anonymousToken}` },
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
