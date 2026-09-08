import { onTestFinished } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { updateEnv } from '@vers/test-utils/bun';

export async function createStubFlyctl(script: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'stub-flyctl-'));

  const binPath = join(dir, 'flyctl');

  await writeFile(binPath, `#!/bin/sh\n${script}\n`, { mode: 0o755 });

  updateEnv('PATH', `${dir}:${process.env['PATH'] ?? ''}`);

  onTestFinished(async () => {
    await rm(dir, { force: true, recursive: true });
  });

  return binPath;
}
