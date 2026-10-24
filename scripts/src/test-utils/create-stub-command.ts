import { onTestFinished } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { updateEnv } from '@vers/test-utils/bun';

export async function createStubCommand(name: string, script: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), `stub-${name}-`));

  const binPath = join(directory, name);

  await writeFile(binPath, `#!/bin/sh\n${script}\n`, { mode: 0o755 });

  updateEnv('PATH', `${directory}:${process.env['PATH'] ?? ''}`);

  onTestFinished(async () => {
    await rm(directory, { force: true, recursive: true });
  });

  return binPath;
}
