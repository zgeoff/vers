import { execa } from 'execa';

interface RunFlyctlOptions {
  readonly inherit?: boolean;
}

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
