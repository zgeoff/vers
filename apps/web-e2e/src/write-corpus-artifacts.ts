import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCorpus } from '@vers/idle-core/corpus/run-corpus';
import invariant from 'tiny-invariant';

const CORPUS_DIR = path.join(import.meta.dirname, '..', '.corpus');

async function writeCorpusArtifacts(): Promise<void> {
  await mkdir(CORPUS_DIR, { recursive: true });

  const registerModulePath = fileURLToPath(
    import.meta.resolve('@vers/idle-core/corpus/register-corpus-global'),
  );

  const build = await Bun.build({
    entrypoints: [registerModulePath],
    format: 'iife',
    target: 'browser',
  });

  invariant(build.success, 'the corpus browser bundle must build cleanly');

  const [bundleOutput] = build.outputs;

  invariant(bundleOutput, 'a successful Bun.build with one entrypoint emits exactly one output');

  const bundleSource = await bundleOutput.text();

  await writeFile(path.join(CORPUS_DIR, 'bundle.js'), bundleSource);

  const digests = await runCorpus();

  await writeFile(path.join(CORPUS_DIR, 'bun-digests.json'), JSON.stringify(digests));
}

await writeCorpusArtifacts();
