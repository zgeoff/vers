import { execa } from 'execa';

interface RunFlyctlOptions {
  readonly inherit?: boolean;
}

/**
 * Runs flyctl and returns captured stdout. Pass `inherit: true` for
 * long-running commands whose progress should stream to the terminal —
 * the return value is then empty.
 */
export async function runFlyctl(
  args: ReadonlyArray<string>,
  options?: RunFlyctlOptions,
): Promise<string> {
  if (options?.inherit === true) {
    await execa('flyctl', args, { stderr: 'inherit', stdout: 'inherit' });

    return '';
  }

  const result = await execa('flyctl', args);

  return result.stdout;
}
