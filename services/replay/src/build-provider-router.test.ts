import { expect, test } from 'bun:test';
import { replayContract } from '@vers/contract-replay';
import { createMockReplaySegmentInput } from '@vers/contract-replay/test-utils';
import { createAnonymousViewer } from '@vers/service-test-utils/bun';
import { buildRPCTestClient, collectConformanceCases } from '@vers/test-utils';
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

test('it rejects a stamp that does not match the baked engine hash with SIM_VERSION_MISMATCH', async () => {
  const service = await createReplayProvider();
  const viewer = await createAnonymousViewer({ audience: 'service-replay-provider' });

  const client = buildRPCTestClient<{ replaySegment: typeof replayContract.replaySegment }>(
    service.app,
    { token: viewer.token },
  );

  const input = createMockReplaySegmentInput({ simVersion: 'some-other-engine-hash' });

  expect(client.replaySegment(input)).rejects.toMatchObject({
    code: 'SIM_VERSION_MISMATCH',
    data: { providerSimVersion: 'test-engine-hash' },
  });
});

test('it 404s on /rpc/wake — a provider serves no drain route', async () => {
  const service = await createReplayProvider();
  const viewer = await createAnonymousViewer({ audience: 'service-replay-provider' });

  const response = await service.app.handle(
    new Request('http://test.local/rpc/wake', {
      body: JSON.stringify({ json: {} }),
      headers: { authorization: `Bearer ${viewer.token}`, 'content-type': 'application/json' },
      method: 'POST',
    }),
  );

  expect(response.status).toBe(404);
});
