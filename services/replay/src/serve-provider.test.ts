import { afterAll, beforeAll, expect, test } from 'bun:test';
import path from 'node:path';
import { createMockReplaySegmentInput } from '@vers/contract-replay/test-utils';
import { createServiceToken, getTestServiceKeyPair } from '@vers/service-test-utils/bun';
import { waitFor } from '@vers/test-utils';

const SERVE_PROVIDER_PATH = path.resolve(import.meta.dirname, 'serve-provider.ts');
const REPLAY_DIR = path.resolve(import.meta.dirname, '..');
const PORT = 41_100;
const URL = `http://127.0.0.1:${PORT}`;
let proc: Bun.Subprocess;

/**
 * Boots the real `serve-provider.ts` entrypoint once for the whole file, on only base env plus
 * `SIM_ENGINE_HASH` — no `DATABASE_URL`, `KEYS_SERVICE_URL`, or `SERVICE_AUTH_PRIVATE_KEY` — the
 * exact env a per-version provider machine boots on, and the regression this entrypoint exists to
 * catch: the in-process test client shares this suite's full ambient env, which would mask a
 * missing env-wiring bug this real process cannot. Provider routing behaviour is covered in-process
 * by `build-provider-router.test.ts`; this file only proves the real entrypoint boots and serves
 * over a socket, so one shared process serves every case.
 */
beforeAll(
  async () => {
    const keyPair = await getTestServiceKeyPair();

    proc = Bun.spawn([process.execPath, SERVE_PROVIDER_PATH], {
      cwd: REPLAY_DIR,
      env: {
        PORT: String(PORT),
        SERVICE_AUTH_JWKS: keyPair.jwksJSON,
        SIM_ENGINE_HASH: 'test-engine-hash',
      },
      stderr: 'pipe',
      stdout: 'pipe',
    });

    // a cold CI runner can take longer than bun's default 5s hook timeout to
    // spawn and boot the process, so both the poll and the hook get headroom
    await waitFor(
      async () => {
        const response = await fetch(`${URL}/health`);

        if (!response.ok) {
          throw new Error(`provider health check returned ${String(response.status)}`);
        }
      },
      { timeoutMs: 15_000 },
    );
  },
  { timeout: 20_000 },
);

afterAll(() => {
  proc?.kill();
});

/**
 * Sends a signed RPC call to the booted provider process over the network — a real socket round
 * trip, not the in-process `app.handle` test client.
 */
function sendRPC(procedure: string, token: string, input: unknown): Promise<Response> {
  return fetch(`${URL}/rpc/${procedure}`, {
    body: JSON.stringify({ json: input }),
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    method: 'POST',
  });
}

test('it serves /health with no database, keys service, or signing key configured', async () => {
  const response = await fetch(`${URL}/health`);
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body).toStrictEqual({ service: 'service-replay-provider', status: 'ok' });
});

test('it round-trips an authed replaySegment call', async () => {
  const keyPair = await getTestServiceKeyPair();

  const token = await createServiceToken({
    audience: 'service-replay-provider',
    privateKey: keyPair.privateKey,
  });

  const input = createMockReplaySegmentInput({ simVersion: 'test-engine-hash' });

  const response = await sendRPC('replaySegment', token, input);
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body).toMatchObject({ json: { elapsed: input.duration } });
});
