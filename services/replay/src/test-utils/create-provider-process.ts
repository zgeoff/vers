import { onTestFinished } from 'bun:test';
import path from 'node:path';
import { getTestServiceKeyPair } from '@vers/service-test-utils/bun';
import { findListeningPort } from './find-listening-port';

const SERVE_PROVIDER_PATH = path.resolve(import.meta.dirname, '..', 'serve-provider.ts');
const REPLAY_DIR = path.resolve(import.meta.dirname, '..', '..');
const BOOT_DEADLINE_MS = 20_000;

interface ProviderProcess {
  readonly url: string;
}

/**
 * Boots the real `serve-provider.ts` entrypoint as a subprocess on only base env plus
 * `SIM_ENGINE_HASH` — no `DATABASE_URL`, `KEYS_SERVICE_URL`, or `SERVICE_AUTH_PRIVATE_KEY` — the
 * exact env a per-version provider machine boots on. An in-process boot would inherit the suite's
 * full ambient env and mask a missing env-wiring bug, which is the regression this fixture exists
 * to catch. `PORT=0` binds an OS-assigned port, read back from the boot log; the process is killed
 * via `onTestFinished`.
 *
 * Readiness is event-driven, not polled: the boot resolves on the log's bound-port announcement,
 * and a process that exits first rejects immediately with its captured output, so a crashing boot
 * reports its real error instead of running out the clock. The deadline only catches a boot that
 * hangs without exiting. stdout keeps draining after the port is found so a full pipe can never
 * block the child.
 */
export async function createProviderProcess(engineHash: string): Promise<ProviderProcess> {
  const keyPair = await getTestServiceKeyPair();

  const proc = Bun.spawn([process.execPath, SERVE_PROVIDER_PATH], {
    cwd: REPLAY_DIR,
    env: {
      PORT: '0',
      SERVICE_AUTH_JWKS: keyPair.jwksJSON,
      SIM_ENGINE_HASH: engineHash,
    },
    stderr: 'pipe',
    stdout: 'pipe',
  });

  onTestFinished(async () => {
    proc.kill();

    await proc.exited;
  });

  const collected: Array<string> = [];

  // consumes stdout to exhaustion — never releasing it mid-run, which would close the pipe under
  // the writing child — reporting the first bound-port announcement and collecting every chunk
  // for failure diagnostics
  const drainForPort = async (onPort: (port: number) => void): Promise<void> => {
    const decoder = new TextDecoder();

    let buffer = '';
    let reported = false;

    for await (const chunk of proc.stdout) {
      const text = decoder.decode(chunk, { stream: true });

      collected.push(text);

      buffer += text;

      const lines = buffer.split('\n');

      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const port = findListeningPort(line);

        if (port !== undefined && !reported) {
          reported = true;

          onPort(port);
        }
      }
    }
  };

  const port = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `provider reported no listening port within ${String(BOOT_DEADLINE_MS)}ms\n${collected.join('')}`,
        ),
      );
    }, BOOT_DEADLINE_MS);

    drainForPort((foundPort) => {
      clearTimeout(timer);
      resolve(foundPort);
    }).catch(() => {});

    const reportExit = async (): Promise<void> => {
      const code = await proc.exited;

      const stderr = await new Response(proc.stderr).text();

      clearTimeout(timer);

      reject(
        new Error(
          `provider exited with code ${String(code)} before serving\n${collected.join('')}${stderr}`,
        ),
      );
    };

    reportExit().catch(() => {});
  });

  return { url: `http://127.0.0.1:${String(port)}` };
}
