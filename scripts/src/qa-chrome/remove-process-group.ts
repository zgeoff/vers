import invariant from 'tiny-invariant';

const KILL_WAIT_MS = 2000;

export async function removeProcessGroup(groupID: number, graceMs: number): Promise<void> {
  // group 0 is the caller's own group, and process 1 is init
  invariant(Number.isSafeInteger(groupID) && groupID > 1, 'a browser group ID is above 1');
  signalGroup(groupID, 'SIGTERM');

  const hasExited = await waitForGroupExit(groupID, graceMs);

  if (hasExited) {
    return;
  }

  signalGroup(groupID, 'SIGKILL');

  const hasDied = await waitForGroupExit(groupID, KILL_WAIT_MS);

  if (!hasDied) {
    throw new Error(`process group ${groupID} still runs after SIGKILL`);
  }
}

function signalGroup(groupID: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-groupID, signal);
  } catch (error) {
    if (!isMissingProcess(error)) {
      throw error;
    }
  }
}

function isMissingProcess(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ESRCH';
}

const POLL_INTERVAL_MS = 100;

async function waitForGroupExit(groupID: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    if (!probeGroupAlive(groupID)) {
      return true;
    }

    if (Date.now() > deadline) {
      return false;
    }

    await Bun.sleep(POLL_INTERVAL_MS);
  }
}

// signal 0 checks that the group still holds a process without signalling it
function probeGroupAlive(groupID: number): boolean {
  try {
    process.kill(-groupID, 0);

    return true;
  } catch (error) {
    return !isMissingProcess(error);
  }
}
