import { spawn } from 'node:child_process';
import type { ChildProcessByStdio } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import invariant from 'tiny-invariant';
import { readProcessStartTime } from '../qa-chrome/read-process-start-time';
import { removeProcessGroup } from '../qa-chrome/remove-process-group';
import { STOP_GRACE_MS } from '../qa-chrome/stop-grace-ms';
import type { OfflineHold, OfflineHoldPaths } from './types';

const HOLD_ENTRYPOINT = join(import.meta.dir, '..', 'bin', 'qa-cdp-offline-hold.ts');

export async function createOfflineHold(
  endpoint: string,
  targetID: string,
  paths: OfflineHoldPaths,
): Promise<OfflineHold> {
  // detached puts the hold in its own process group, which outlives this command and which a
  // removal signals as one
  const child = spawn(process.execPath, [HOLD_ENTRYPOINT, '--endpoint', endpoint, targetID], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const groupID = child.pid;

  invariant(groupID !== undefined, 'the running Bun executable spawns with a process ID');

  try {
    await waitForHoldReady(child);
  } catch (error) {
    await removeProcessGroup(groupID, STOP_GRACE_MS);

    throw error;
  }

  child.stdout.destroy();
  child.stderr.destroy();
  child.unref();

  const startTime = await readProcessStartTime(groupID);

  invariant(startTime !== undefined, 'a hold that reported ready is a live process');

  const hold = { pid: groupID, startTime };

  await mkdir(paths.directory, { recursive: true });
  await writeFile(paths.stateFile, `${JSON.stringify(hold)}\n`);

  return hold;
}

const READY_TIMEOUT_MS = 30_000;

async function waitForHoldReady(child: ChildProcessByStdio<null, Readable, Readable>) {
  const ready = Promise.withResolvers<void>();
  let stdout = '';
  let stderr = '';

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  child.stdout.on('data', (chunk: string) => {
    stdout += chunk;

    if (stdout.includes('\n')) {
      ready.resolve();
    }
  });

  child.stderr.on('data', (chunk: string) => {
    stderr += chunk;
  });

  child.once('close', (code) => {
    const reason = stderr.trim();
    const message = reason === '' ? `the offline hold exited with code ${code}` : reason;

    ready.reject(new Error(message));
  });

  const timer = setTimeout(() => {
    ready.reject(new Error(`the offline hold did not report ready within ${READY_TIMEOUT_MS} ms`));
  }, READY_TIMEOUT_MS);

  try {
    await ready.promise;
  } finally {
    clearTimeout(timer);
  }
}
