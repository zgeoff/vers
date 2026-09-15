import { spawnSync } from 'node:child_process';
import path from 'node:path';
import invariant from 'tiny-invariant';

export default function setupCorpusArtifacts(): void {
  const scriptPath = path.join(import.meta.dirname, 'write-corpus-artifacts.ts');
  const result = spawnSync('bun', [scriptPath], { stdio: 'inherit' });

  invariant(result.status === 0, 'writing the corpus artifacts must exit cleanly');
}
