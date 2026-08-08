import { expect, test } from 'bun:test';
import { createMockReplaySegmentInput } from '@vers/contract-replay/test-utils';
import { createServiceToken, getTestServiceKeyPair } from '@vers/service-test-utils/bun';
import { createProviderProcess } from './test-utils/create-provider-process';

// each test boots its own subprocess, so the test budget covers a cold boot, not just assertions
const BOOT_TIMEOUT_MS = 30_000;

test(
  'it serves /health with no database, keys service, or signing key configured',
  async () => {
    const ctx = await createProviderProcess('test-engine-hash');
    const response = await fetch(`${ctx.url}/health`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toStrictEqual({ service: 'service-replay-provider', status: 'ok' });
  },
  BOOT_TIMEOUT_MS,
);

test(
  'it round-trips an authed replaySegment call over a real socket',
  async () => {
    const ctx = await createProviderProcess('test-engine-hash');
    const keyPair = await getTestServiceKeyPair();

    const token = await createServiceToken({
      audience: 'service-replay-provider',
      privateKey: keyPair.privateKey,
    });

    const input = createMockReplaySegmentInput({ simVersion: 'test-engine-hash' });

    const response = await fetch(`${ctx.url}/rpc/replaySegment`, {
      body: JSON.stringify({ json: input }),
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      method: 'POST',
    });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ json: { elapsed: input.duration } });
  },
  BOOT_TIMEOUT_MS,
);
