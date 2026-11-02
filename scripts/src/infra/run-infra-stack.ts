import path from 'node:path';
import { $ } from 'bun';
import type { InfraStackResult } from './types';

interface InfraStackOptions {
  readonly args: ReadonlyArray<string>;
  readonly infraPath: string;
}

const pulumiStackPath = path.resolve(import.meta.dirname, '../bin/pulumi-stack.ts');

// one op process signs in once for every reference in .env.example, where 1Password throttled an
// action that signed in once per secret; op conceals each secret it resolved in its own streams,
// so the output comes from op, never from inside the command
export async function runInfraStack(
  options: Readonly<InfraStackOptions>,
): Promise<InfraStackResult> {
  const result = await $`op run --env-file=.env.example -- bun ${pulumiStackPath} ${options.args}`
    .cwd(options.infraPath)
    .nothrow()
    .quiet();

  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}
