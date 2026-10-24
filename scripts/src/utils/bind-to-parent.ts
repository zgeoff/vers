import { constants } from 'node:os';
import type { Subprocess } from 'bun';

interface BindToParentOptions {
  readonly graceMs?: number;
  readonly killSignal?: NodeJS.Signals;
}

type BoundChild = Pick<Subprocess, 'exited' | 'kill'>;

const PARENT_SIGNALS = ['SIGHUP', 'SIGINT', 'SIGTERM'] as const;
const DEFAULT_GRACE_MS = 5000;

const childEndings = new Set<Promise<void>>();

export function bindToParent(child: BoundChild, options?: BindToParentOptions): void {
  const killSignal = options?.killSignal ?? 'SIGTERM';
  const graceMs = options?.graceMs ?? DEFAULT_GRACE_MS;

  const handleSignal = (signal: NodeJS.Signals) => {
    childEndings.add(endChild(child, killSignal, graceMs));

    // a listener on a signal turns off the runtime's default exit, so the last listener to run
    // ends the process, once every bound child is gone, with the code that default exit gives
    if (process.listenerCount(signal) === 0) {
      void exitAfterChildren(signal);
    }
  };

  const handleExit = () => {
    child.kill(killSignal);
  };

  // prepended so the child gets its signal before a later listener, such as an interrupt handler
  // that exits at once, ends the process
  for (const signal of PARENT_SIGNALS) {
    process.prependOnceListener(signal, handleSignal);
  }

  process.once('exit', handleExit);
  void unbindOnExit(child, handleSignal, handleExit);
}

async function endChild(child: BoundChild, killSignal: NodeJS.Signals, graceMs: number) {
  child.kill(killSignal);

  const forceKill = setTimeout(() => {
    child.kill('SIGKILL');
  }, graceMs);

  await child.exited;

  clearTimeout(forceKill);
}

const SIGNAL_EXIT_BASE = 128;

async function exitAfterChildren(signal: NodeJS.Signals): Promise<void> {
  await Promise.all(childEndings);

  process.exit(SIGNAL_EXIT_BASE + constants.signals[signal]);
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
