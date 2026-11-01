import type { Subprocess } from 'bun';
import { bindToParent } from './bind-to-parent';
import { FlyctlError } from './flyctl-error';

interface FlyctlInterrupt {
  readonly afterMs: number;
  readonly graceMs: number;
}

interface RunFlyctlOptions {
  readonly cancelSignal?: AbortSignal;
  readonly inherit?: boolean;
  readonly interrupt?: FlyctlInterrupt;
  readonly stallInterrupt?: FlyctlInterrupt;
}

export async function runFlyctl(
  args: ReadonlyArray<string>,
  options?: RunFlyctlOptions,
): Promise<string> {
  const isInherited = options?.inherit === true;
  const interrupt = options?.interrupt;
  const stallInterrupt = options?.stallInterrupt;

  // the stall watch has to see each chunk, so it pipes the output and forwards it to the parent's
  const output = isInherited && stallInterrupt === undefined ? 'inherit' : 'pipe';

  // SIGINT is flyctl's ctrl-c, which aborts an in-flight bluegreen deploy and destroys its green
  // machines; SIGKILL after the grace leaves them started
  const flyctl = Bun.spawn(['flyctl', ...args], {
    ...(interrupt === undefined
      ? {}
      : { killSignal: 'SIGINT' as const, timeout: interrupt.afterMs }),
    ...(options?.cancelSignal === undefined ? {} : { signal: options.cancelSignal }),

    // without an env, Bun.spawn looks flyctl up on the PATH Bun started with, not the live one
    env: process.env,
    stderr: output,
    stdout: output,
  });

  const parentExit =
    interrupt === undefined ? {} : { graceMs: interrupt.graceMs, killSignal: 'SIGINT' as const };

  bindToParent(flyctl, parentExit);

  const forceKill =
    interrupt === undefined
      ? undefined
      : setTimeout(() => {
          flyctl.kill('SIGKILL');
        }, interrupt.afterMs + interrupt.graceMs);

  const stallWatch =
    stallInterrupt === undefined ? undefined : createStallWatch(flyctl, stallInterrupt);

  const [stdout, stderr] = await Promise.all([
    readOutput(flyctl.stdout, { forwardTo: isInherited ? process.stdout : undefined, stallWatch }),
    readOutput(flyctl.stderr, { forwardTo: isInherited ? process.stderr : undefined, stallWatch }),
    flyctl.exited,
  ]);

  clearTimeout(forceKill);
  stallWatch?.stop();
  const isStalled = stallWatch?.isStalled() === true;

  if (flyctl.exitCode !== 0 || isStalled) {
    throw new FlyctlError({
      args,
      exitCode: flyctl.exitCode,
      signal: flyctl.signalCode,
      stalledAfterMs: isStalled ? (stallInterrupt?.afterMs ?? null) : null,
      stderr,
      stdout,
    });
  }

  return stdout;
}

interface StallWatch {
  readonly isStalled: () => boolean;
  readonly reset: () => void;
  readonly stop: () => void;
}

function createStallWatch(
  child: Pick<Subprocess, 'kill'>,
  stallInterrupt: FlyctlInterrupt,
): StallWatch {
  let isStalled = false;
  let forceKill: ReturnType<typeof setTimeout> | undefined;

  const stallTimer = setTimeout(() => {
    isStalled = true;

    child.kill('SIGINT');

    forceKill = setTimeout(() => {
      child.kill('SIGKILL');
    }, stallInterrupt.graceMs);
  }, stallInterrupt.afterMs);

  return {
    isStalled: () => isStalled,
    reset: () => {
      if (!isStalled) {
        stallTimer.refresh();
      }
    },
    stop: () => {
      clearTimeout(stallTimer);
      clearTimeout(forceKill);
    },
  };
}

interface OutputSink {
  readonly forwardTo: NodeJS.WriteStream | undefined;
  readonly stallWatch: StallWatch | undefined;
}

async function readOutput(
  stream: ReadableStream<Uint8Array> | number | undefined,
  sink: OutputSink,
): Promise<string> {
  if (!(stream instanceof ReadableStream)) {
    return '';
  }

  if (sink.stallWatch === undefined) {
    return new Response(stream).text();
  }

  const decoder = new TextDecoder();

  let text = '';

  for await (const chunk of stream) {
    sink.stallWatch.reset();

    if (sink.forwardTo === undefined) {
      text += decoder.decode(chunk, { stream: true });
    } else {
      sink.forwardTo.write(chunk);
    }
  }

  return text + decoder.decode();
}
