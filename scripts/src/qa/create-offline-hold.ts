import { spawn } from 'node:child_process';
import type { ChildProcessByStdio } from 'node:child_process';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Readable, Writable } from 'node:stream';
import invariant from 'tiny-invariant';
import { readProcessStartTime } from '../qa-chrome/read-process-start-time';
import { removeProcessGroup } from '../qa-chrome/remove-process-group';
import { STOP_GRACE_MS } from '../qa-chrome/stop-grace-ms';
import { HOLD_SAVED_LINE } from './constants';
import type { OfflineHold, OfflineHoldPaths } from './types';

const HOLD_ENTRYPOINT = join(import.meta.dir, '..', 'bin', 'qa-cdp-offline-hold.ts');

export async function createOfflineHold(
  endpoint: string,
  targetID: string,
  paths: OfflineHoldPaths,
): Promise<OfflineHold> {
  // detached puts the hold in its own process group, which outlives this command and which a
  // removal signals as one
  // a log left by an ended hold would print with the next offline off as this hold's failures
  await rm(paths.logFile, { force: true });

  const args = [HOLD_ENTRYPOINT, '--endpoint', endpoint, '--log', paths.logFile, targetID];

  const child = spawn(process.execPath, args, {
    detached: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const groupID = child.pid;

  invariant(groupID !== undefined, 'the running Bun executable spawns with a process ID');

  try {
    await waitForHoldReady(child);

    const startTime = await readProcessStartTime(groupID);

    invariant(startTime !== undefined, 'a hold that reported ready is a live process');

    const hold = { pid: groupID, startTime };

    await writeHoldState(paths, hold);
    await writeSaveConfirmation(child.stdin);

    return hold;
  } catch (error) {
    // a hold that no state file records is one that offline off can never stop
    await removeProcessGroup(groupID, STOP_GRACE_MS);

    throw error;
  } finally {
    child.stdin.destroy();
    child.stdout.destroy();
    child.stderr.destroy();
    child.unref();
  }
}

const READY_TIMEOUT_MS = 30_000;

async function waitForHoldReady(child: ChildProcessByStdio<Writable, Readable, Readable>) {
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

async function writeHoldState(paths: OfflineHoldPaths, hold: OfflineHold): Promise<void> {
  const temporaryFile = `${paths.stateFile}.tmp`;

  await mkdir(paths.directory, { recursive: true });

  // a rename replaces the state file whole, so a failed write never leaves a partial one behind
  try {
    await writeFile(temporaryFile, `${JSON.stringify(hold)}\n`);
    await rename(temporaryFile, paths.stateFile);
  } catch (error) {
    await rm(temporaryFile, { force: true });

    throw error;
  }
}

async function writeSaveConfirmation(stdin: Writable): Promise<void> {
  const written = Promise.withResolvers<void>();

  stdin.once('error', written.reject);
  stdin.end(`${HOLD_SAVED_LINE}\n`, written.resolve);

  await written.promise;
}
