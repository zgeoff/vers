import { expect, onTestFinished, test } from 'bun:test';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { waitFor } from '@vers/test-utils';
import { readFreePort } from '../verify/local/read-free-port';

async function setupTest() {
  const directory = await mkdtemp(join(tmpdir(), 'stub-held-server-'));

  onTestFinished(() => rm(directory, { recursive: true, force: true }));

  const port = readFreePort();

  const server = Bun.spawn(['bun', join(import.meta.dir, 'run-stub-held-server.ts')], {
    env: { ...process.env, STUB_PORT: String(port), STUB_PID_DIRECTORY: directory },
    stderr: 'pipe',
  });

  onTestFinished(() => {
    server.kill('SIGKILL');
  });

  return { directory, server, healthURL: `http://127.0.0.1:${port}/health` };
}

test('it still answers /health after SIGTERM', async () => {
  const ctx = await setupTest();

  await waitFor(() => fetch(ctx.healthURL), { timeoutMs: 3000 });

  ctx.server.kill('SIGTERM');

  const stderr = ctx.server.stderr.getReader();

  const held = await stderr.read();
  const response = await fetch(ctx.healthURL);

  expect({
    held: new TextDecoder().decode(held.value),
    status: response.status,
    exitCode: ctx.server.exitCode,
  }).toStrictEqual({
    held: 'stub held server: holding its stop\n',
    status: 200,
    exitCode: null,
  });
});

test('it writes its pid into the pid folder once it serves', async () => {
  const ctx = await setupTest();

  await waitFor(() => fetch(ctx.healthURL), { timeoutMs: 3000 });

  const names = await readdir(ctx.directory);

  expect(names).toStrictEqual([String(ctx.server.pid)]);
});
