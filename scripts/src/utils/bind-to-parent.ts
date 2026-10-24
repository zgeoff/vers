import { constants } from 'node:os';
import type { Subprocess } from 'bun';

const PARENT_SIGNALS = ['SIGHUP', 'SIGINT', 'SIGTERM'] as const;
const SIGNAL_EXIT_BASE = 128;

export function bindToParent(
  child: Pick<Subprocess, 'exited' | 'kill'>,
  killSignal: NodeJS.Signals = 'SIGTERM',
): void {
  const handleSignal = (signal: NodeJS.Signals) => {
    child.kill(killSignal);

    // a listener on a signal turns off the runtime's default exit, so the last listener to run
    // ends the process with the code that default exit gives
    if (process.listenerCount(signal) === 0) {
      process.exit(SIGNAL_EXIT_BASE + constants.signals[signal]);
    }
  };

  const handleExit = () => {
    child.kill(killSignal);
  };

  // prepended so the child dies before a later listener, such as an interrupt handler that exits
  // at once, ends the process
  for (const signal of PARENT_SIGNALS) {
    process.prependOnceListener(signal, handleSignal);
  }

  process.once('exit', handleExit);
  void unbindOnExit(child, handleSignal, handleExit);
}

async function unbindOnExit(
  child: Pick<Subprocess, 'exited'>,
  handleSignal: (signal: NodeJS.Signals) => void,
  handleExit: () => void,
): Promise<void> {
  await child.exited;

  for (const signal of PARENT_SIGNALS) {
    process.removeListener(signal, handleSignal);
  }

  process.removeListener('exit', handleExit);
}
