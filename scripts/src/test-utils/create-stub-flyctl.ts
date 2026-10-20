import { onTestFinished } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { updateEnv } from '@vers/test-utils/bun';

export async function createStubFlyctl(script: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'stub-flyctl-'));

  const binPath = join(directory, 'flyctl');

  await writeFile(binPath, `#!/bin/sh\n${script}\n`, { mode: 0o755 });

  updateEnv('PATH', `${directory}:${process.env['PATH'] ?? ''}`);

  onTestFinished(async () => {
    await rm(directory, { force: true, recursive: true });
  });

  return binPath;
}
