import { readProcessStartTime } from './read-process-start-time';
import type { ChromeState } from './types';

const GRACE_MS = 5000;
const POLL_INTERVAL_MS = 100;

export async function removeChrome(state: ChromeState): Promise<void> {
  signalGroup(state.leaderPID, 'SIGTERM');

  const deadline = Date.now() + GRACE_MS;

  for (;;) {
    const startTime = await readProcessStartTime(state.leaderPID);

    if (startTime !== state.leaderStartTime) {
      return;
    }

    if (Date.now() > deadline) {
      signalGroup(state.leaderPID, 'SIGKILL');

      return;
    }

    await Bun.sleep(POLL_INTERVAL_MS);
  }
}

function signalGroup(leaderPID: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-leaderPID, signal);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) {
      throw error;
    }
  }
}
