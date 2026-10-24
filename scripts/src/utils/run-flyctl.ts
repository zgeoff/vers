interface FlyctlInterrupt {
  readonly afterMs: number;
  readonly graceMs: number;
}

interface RunFlyctlOptions {
  readonly cancelSignal?: AbortSignal;
  readonly inherit?: boolean;
  readonly interrupt?: FlyctlInterrupt;
}

export async function runFlyctl(
  args: ReadonlyArray<string>,
  options?: RunFlyctlOptions,
): Promise<string> {
  const output = options?.inherit === true ? 'inherit' : 'pipe';
  const interrupt = options?.interrupt;

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

  const forceKill =
    interrupt === undefined
      ? undefined
      : setTimeout(() => {
          flyctl.kill('SIGKILL');
        }, interrupt.afterMs + interrupt.graceMs);

  const [stdout, stderr] = await Promise.all([
    readOutput(flyctl.stdout),
    readOutput(flyctl.stderr),
    flyctl.exited,
  ]);

  clearTimeout(forceKill);

  if (flyctl.exitCode !== 0) {
    throw new FlyctlError({
      args,
      exitCode: flyctl.exitCode,
      signal: flyctl.signalCode,
      stderr,
      stdout,
    });
  }

  return stdout;
}

function readOutput(stream: ReadableStream<Uint8Array> | number | undefined): Promise<string> {
  return stream instanceof ReadableStream ? new Response(stream).text() : Promise.resolve('');
}

interface FlyctlFailure {
  readonly args: ReadonlyArray<string>;
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stderr: string;
  readonly stdout: string;
}

class FlyctlError extends Error {
  readonly exitCode: number | null;

  readonly signal: NodeJS.Signals | null;

  readonly stderr: string;

  readonly stdout: string;

  constructor(failure: FlyctlFailure) {
    const ending =
      failure.signal === null ? `exit code ${failure.exitCode}` : `signal ${failure.signal}`;

    super(`flyctl ${failure.args.join(' ')} failed with ${ending}\n${failure.stderr}`.trimEnd());

    this.name = 'FlyctlError';
    this.exitCode = failure.exitCode;
    this.signal = failure.signal;
    this.stderr = failure.stderr;
    this.stdout = failure.stdout;
  }
}
