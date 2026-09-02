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

// a subprocess, not an in-process boot: an in-process boot inherits the suite's full ambient env
// and masks a missing env-wiring bug, which is the regression this fixture exists to catch
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
  const stderrCollected: Array<string> = [];

  // both pipes drain to exhaustion from the start — an unread pipe would block the child once its
  // buffer fills, hanging the boot without ever reporting the real error
  const drainStderr = async (): Promise<void> => {
    const decoder = new TextDecoder();

    for await (const chunk of proc.stderr) {
      stderrCollected.push(decoder.decode(chunk, { stream: true }));
    }
  };

  const stderrDrain = drainStderr();

  // consumes stdout to exhaustion, reporting the first bound-port announcement and collecting
  // every chunk for failure diagnostics
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
          `provider reported no listening port within ${String(BOOT_DEADLINE_MS)}ms\n${collected.join('')}${stderrCollected.join('')}`,
        ),
      );
    }, BOOT_DEADLINE_MS);

    drainForPort((foundPort) => {
      clearTimeout(timer);
      resolve(foundPort);
    }).catch(() => {});

    const reportExit = async (): Promise<void> => {
      const code = await proc.exited;

      // the drain ends when the pipe closes at process death, so the message carries all of stderr
      await stderrDrain.catch(() => {});

      clearTimeout(timer);

      reject(
        new Error(
          `provider exited with code ${String(code)} before serving\n${collected.join('')}${stderrCollected.join('')}`,
        ),
      );
    };

    reportExit().catch(() => {});
  });

  return { url: `http://127.0.0.1:${String(port)}` };
}
