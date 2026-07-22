import { expect, onTestFinished, test } from 'bun:test';
import path from 'node:path';
import { createMockReplaySegmentInput } from '@vers/contract-replay/test-utils';
import { createServiceToken, getTestServiceKeyPair } from '@vers/service-test-utils/bun';
import { waitFor } from '@vers/test-utils';

const SERVE_PROVIDER_PATH = path.resolve(import.meta.dirname, 'serve-provider.ts');
const REPLAY_DIR = path.resolve(import.meta.dirname, '..');
let nextPort = 41_100;

/**
 * Starts the real `serve-provider.ts` entrypoint in a subprocess on only base env plus
 * `SIM_ENGINE_HASH` — no `DATABASE_URL`, `KEYS_SERVICE_URL`, or `SERVICE_AUTH_PRIVATE_KEY` — the
 * exact env a per-version provider machine boots on, and the regression this entrypoint exists to
 * fix: the in-process test client shares this suite's full ambient env, which would mask a missing
 * env-wiring bug this real process cannot. Kills the subprocess once the calling test finishes.
 */
async function startProviderProcess(): Promise<string> {
  const keyPair = await getTestServiceKeyPair();

  const port = nextPort;

  nextPort += 1;

  const url = `http://127.0.0.1:${port}`;

  const proc = Bun.spawn([process.execPath, SERVE_PROVIDER_PATH], {
    cwd: REPLAY_DIR,
    env: {
      PORT: String(port),
      SERVICE_AUTH_JWKS: keyPair.jwksJSON,
      SIM_ENGINE_HASH: 'test-engine-hash',
    },
    stderr: 'pipe',
    stdout: 'pipe',
  });

  onTestFinished(() => {
    proc.kill();
  });

  await waitFor(
    async () => {
      const response = await fetch(`${url}/health`);

      if (!response.ok) {
        throw new Error(`provider health check returned ${String(response.status)}`);
      }
    },
    { timeoutMs: 5000 },
  );

  return url;
}

/**
 * Sends a signed RPC call to a booted provider process over the network — a real socket round
 * trip, not the in-process `app.handle` test client.
 */
function sendRPC(url: string, procedure: string, token: string, input: unknown): Promise<Response> {
  return fetch(`${url}/rpc/${procedure}`, {
    body: JSON.stringify({ json: input }),
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    method: 'POST',
  });
}

test('it serves /health with no database, keys service, or signing key configured', async () => {
  const url = await startProviderProcess();
  const response = await fetch(`${url}/health`);
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body).toStrictEqual({ service: 'service-replay-provider', status: 'ok' });
});

test('it round-trips an authed replaySegment call', async () => {
  const url = await startProviderProcess();
  const keyPair = await getTestServiceKeyPair();

  const token = await createServiceToken({
    audience: 'service-replay-provider',
    privateKey: keyPair.privateKey,
  });

  const input = createMockReplaySegmentInput({ simVersion: 'test-engine-hash' });

  const response = await sendRPC(url, 'replaySegment', token, input);
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body).toMatchObject({ json: { elapsed: input.duration } });
});

test('it rejects a stamp that does not match the baked engine hash with SIM_VERSION_MISMATCH', async () => {
  const url = await startProviderProcess();
  const keyPair = await getTestServiceKeyPair();

  const token = await createServiceToken({
    audience: 'service-replay-provider',
    privateKey: keyPair.privateKey,
  });

  const input = createMockReplaySegmentInput({ simVersion: 'some-other-engine-hash' });

  const response = await sendRPC(url, 'replaySegment', token, input);
  const body = await response.json();

  expect(response.status).toBe(409);

  expect(body).toMatchObject({
    json: { code: 'SIM_VERSION_MISMATCH', data: { providerSimVersion: 'test-engine-hash' } },
  });
});

test('it 404s on /rpc/wake — a provider serves no drain route', async () => {
  const url = await startProviderProcess();
  const keyPair = await getTestServiceKeyPair();

  const token = await createServiceToken({
    audience: 'service-replay-provider',
    privateKey: keyPair.privateKey,
  });

  const response = await sendRPC(url, 'wake', token, {});

  expect(response.status).toBe(404);
});
