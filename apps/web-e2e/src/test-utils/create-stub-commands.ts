import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

export interface StubCommands {
  readonly binDirectory: string;
  readonly logPath: string;
}

export interface StubCommandCall {
  readonly name: string;
  readonly args: ReadonlyArray<string>;
}

// Writes a shim for each name into `<directory>/bin`, so a PATH that starts there runs the stand-in
// in run-stub-command.ts in place of the real CLI.
export async function createStubCommands(
  directory: string,
  names: ReadonlyArray<string>,
): Promise<StubCommands> {
  const binDirectory = join(directory, 'bin');
  const logPath = join(directory, 'stub-commands.log');
  const scriptPath = join(import.meta.dir, 'run-stub-command.ts');

  await mkdir(binDirectory, { recursive: true });
  await writeFile(logPath, '');

  await Promise.all(
    names.map(async (name) => {
      const shimPath = join(binDirectory, name);

      await writeFile(shimPath, `#!/bin/sh\nexec bun '${scriptPath}' '${name}' "$@"\n`);
      await chmod(shimPath, 0o755);
    }),
  );

  return { binDirectory, logPath };
}

const callSchema = z.object({ name: z.string(), args: z.array(z.string()) });

// Each call the stand-ins logged, in the order they started.
export async function readStubCommandCalls(
  logPath: string,
): Promise<ReadonlyArray<StubCommandCall>> {
  const text = await readFile(logPath, 'utf8');

  return text
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => callSchema.parse(JSON.parse(line)));
}
