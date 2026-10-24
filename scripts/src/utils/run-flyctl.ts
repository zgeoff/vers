import { execa } from 'execa';

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
  const cancellation =
    options?.cancelSignal === undefined ? {} : { cancelSignal: options.cancelSignal };

  // SIGINT is flyctl's ctrl-c, which aborts an in-flight bluegreen deploy and destroys its green
  // machines; SIGKILL after the grace leaves them started
  const interruption =
    options?.interrupt === undefined
      ? {}
      : {
          forceKillAfterDelay: options.interrupt.graceMs,
          killSignal: 'SIGINT' as const,
          timeout: options.interrupt.afterMs,
        };

  if (options?.inherit === true) {
    await execa('flyctl', args, {
      ...cancellation,
      ...interruption,
      stderr: 'inherit',
      stdout: 'inherit',
    });

    return '';
  }

  const result = await execa('flyctl', args, { ...cancellation, ...interruption });

  return result.stdout;
}
