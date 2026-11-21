import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { updateEnv } from '@zgeoff/testing';
import { createTempDir } from '@zgeoff/testing/fs';

// puts a command that runs the script first on `PATH`. The script is the command itself, with no
// recording process in front of it, because a stub in these tests has to receive the signals the
// code under test sends: the kit's `createStubBin` runs a script behind a recorder that takes them.
export function createStubCommand(name: string, script: string): string {
  const directory = createTempDir(`stub-${name}`).path;
  const binPath = join(directory, name);

  writeFileSync(binPath, `#!/bin/sh\n${script}\n`);
  chmodSync(binPath, 0o755);
  updateEnv('PATH', `${directory}:${process.env['PATH'] ?? ''}`);

  return binPath;
}
