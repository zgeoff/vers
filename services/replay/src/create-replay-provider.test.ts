import { expect, test } from 'bun:test';
import { createMockReplaySegmentInput } from '@vers/contract-replay/test-utils';
import { createAnonymousViewer } from '@vers/service-test-utils/bun';
import { createReplayProvider } from './create-replay-provider';

test('it boots from env.SIM_ENGINE_HASH', async () => {
  const service = await createReplayProvider();

  expect(service.env.SIM_ENGINE_HASH).toBe('test-engine-hash');
});

test('it accepts a call from service-replay', async () => {
  const service = await createReplayProvider();

  const viewer = await createAnonymousViewer({
    audience: 'service-replay-provider',
    issuer: 'service-replay',
  });

  const input = createMockReplaySegmentInput({ simVersion: 'test-engine-hash' });

  const response = await service.app.handle(
    new Request('http://test.local/rpc/replaySegment', {
      body: JSON.stringify({ json: input }),
      headers: { authorization: `Bearer ${viewer.token}`, 'content-type': 'application/json' },
      method: 'POST',
    }),
  );

  expect(response.status).toBe(200);
});

test('it rejects a call from app-web with 403', async () => {
  const service = await createReplayProvider();

  const viewer = await createAnonymousViewer({
    audience: 'service-replay-provider',
    issuer: 'app-web',
  });

  const response = await service.app.handle(
    new Request('http://test.local/rpc/replaySegment', {
      headers: { authorization: `Bearer ${viewer.token}` },
      method: 'POST',
    }),
  );

  expect(response.status).toBe(403);
});
