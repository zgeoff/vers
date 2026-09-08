import { execa } from 'execa';

interface RunFlyctlOptions {
  readonly cancelSignal?: AbortSignal;
  readonly inherit?: boolean;
}

export async function runFlyctl(
  args: ReadonlyArray<string>,
  options?: RunFlyctlOptions,
): Promise<string> {
  const cancellation =
    options?.cancelSignal === undefined ? {} : { cancelSignal: options.cancelSignal };

  if (options?.inherit === true) {
    await execa('flyctl', args, { ...cancellation, stderr: 'inherit', stdout: 'inherit' });

    return '';
  }

  const result = await execa('flyctl', args, cancellation);

  return result.stdout;
}
