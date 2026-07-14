import { expect, test } from 'bun:test';
import { replayContract } from '@vers/contract-replay';
import { createAnonymousViewer } from '@vers/service-test-utils/bun';
import { collectConformanceCases } from '@vers/test-utils';
import { createReplayService } from './create-replay-service';

test('it passes every conformance case collected from its contract', async () => {
  const service = await createReplayService();
  const viewer = await createAnonymousViewer({ audience: 'service-replay' });

  const cases = collectConformanceCases(replayContract, {
    anonymousHeaders: { authorization: `Bearer ${viewer.token}` },
  });

  for (const conformanceCase of cases) {
    await expect(conformanceCase.run(service.app)).toResolve();
  }
});
