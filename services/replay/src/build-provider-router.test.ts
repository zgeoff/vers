import { expect, test } from 'bun:test';
import { replayContract } from '@vers/contract-replay';
import { createAnonymousViewer } from '@vers/service-test-utils/bun';
import { collectConformanceCases } from '@vers/test-utils';
import { createReplayProvider } from './create-replay-provider';

test('it passes every conformance case collected from its narrowed contract', async () => {
  const service = await createReplayProvider();
  const viewer = await createAnonymousViewer({ audience: 'service-replay-provider' });

  const cases = collectConformanceCases(
    { replaySegment: replayContract.replaySegment },
    { anonymousHeaders: { authorization: `Bearer ${viewer.token}` } },
  );

  for (const conformanceCase of cases) {
    await expect(conformanceCase.run(service.app)).toResolve();
  }
});
