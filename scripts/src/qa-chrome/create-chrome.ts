import { spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import invariant from 'tiny-invariant';
import { probeDevToolsEndpoint } from './probe-devtools-endpoint';
import { readProcessStartTime } from './read-process-start-time';
import { removeProcessGroup } from './remove-process-group';
import { STOP_GRACE_MS } from './stop-grace-ms';
import type { ChromePaths, ChromeState } from './types';

interface CreateChromeOptions {
  readonly command: ReadonlyArray<string>;
  readonly isNetns: boolean;
  readonly paths: ChromePaths;
  readonly port: number;
}

const READY_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 200;

export async function createChrome(options: CreateChromeOptions): Promise<ChromeState> {
  const [program, ...args] = options.command;

  invariant(program !== undefined, 'the browser command names a program');

  await mkdir(options.paths.directory, { recursive: true });

  const log = openSync(options.paths.logFile, 'w');

  // detached puts the browser in its own process group, which outlives this command and which a
  // stop signals as one
  const child = spawn(program, args, { detached: true, stdio: ['ignore', log, log] });

  closeSync(log);

  child.unref();

  const groupID = child.pid;

  invariant(groupID !== undefined, 'a program that Bun.which found spawns with a process ID');

  let exitCode: number | null = null;
  let hasExited = false;

  child.once('exit', (code) => {
    exitCode = code;
    hasExited = true;
  });

  const deadline = Date.now() + READY_TIMEOUT_MS;

  for (;;) {
    const isReady = await probeDevToolsEndpoint(options.port);

    if (isReady) {
      break;
    }

    if (hasExited || Date.now() > deadline) {
      const reason = hasExited ? `exited with code ${String(exitCode)}` : 'did not answer in time';

      // a process the leader started can outlive it, and no state file will point a stop at it
      await removeProcessGroup(groupID, STOP_GRACE_MS);

      const tail = await readLogTail(options.paths.logFile);

      throw new Error(`the browser ${reason}; the end of ${options.paths.logFile}:\n${tail}`);
    }

    await Bun.sleep(POLL_INTERVAL_MS);
  }

  const leaderStartTime = await readProcessStartTime(groupID);

  invariant(leaderStartTime !== undefined, 'a browser that answers is a live process');

  const holderPID = options.isNetns ? await readHolderPID(groupID) : null;

  return {
    leaderPID: groupID,
    leaderStartTime,
    namespace: holderPID === null ? null : { cut: null, holderPID },
    port: options.port,
  };
}

const LOG_TAIL_LINES = 20;

async function readLogTail(logFile: string): Promise<string> {
  const text = await readFile(logFile, 'utf8').catch(() => '');

  return text.trimEnd().split('\n').slice(-LOG_TAIL_LINES).join('\n');
}

async function readHolderPID(pastaPID: number): Promise<number> {
  const children = await readFile(`/proc/${pastaPID}/task/${pastaPID}/children`, 'utf8');

  const holderPID = Number(children.trim().split(' ')[0]);

  invariant(Number.isSafeInteger(holderPID) && holderPID > 0, 'pasta runs the namespace holder');

  return holderPID;
}
