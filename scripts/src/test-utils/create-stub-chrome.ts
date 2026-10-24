import { onTestFinished } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function createStubChrome(script: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'stub-chrome-'));

  const binPath = join(directory, 'chrome');

  await writeFile(binPath, `#!/bin/sh\n${script}\n`, { mode: 0o755 });

  onTestFinished(async () => {
    await rm(directory, { force: true, recursive: true });
  });

  return binPath;
}
