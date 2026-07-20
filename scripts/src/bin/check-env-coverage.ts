import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import { loadDeployManifest } from '../deploy/load-deploy-manifest';
import { collectComposeEnvKeys } from '../env/collect-compose-env-keys';
import { findEnvGaps } from '../env/find-env-gaps';
import { loadEnvContract } from '../env/load-env-contract';
import { parseEnvKeys } from '../env/parse-env-keys';
import type { EnvKeySource } from '../env/types';

interface ComposeStack {
  readonly dir: string;
  readonly file: string;
}

const COMPOSE_STACKS: ReadonlyArray<ComposeStack> = [
  { dir: '.', file: 'docker-compose.yml' },
  { dir: 'apps/web-e2e', file: 'apps/web-e2e/docker-compose.stack.yml' },
];

const composeDocs = new Map<string, unknown>();

for (const stack of COMPOSE_STACKS) {
  const source = await readFile(stack.file, 'utf8');

  composeDocs.set(stack.file, parse(source, { merge: true }));
}

// keys a target's Dockerfile bakes into the compiled binary from build args: satisfied wherever
// the built image runs, so they count as covered in the compose stacks (which run those images)
// but not in the plain-process dev env files
const bakedKeysByConfigDir = new Map<string, ReadonlyArray<string>>();

const manifest = await loadDeployManifest();

for (const target of manifest.apps) {
  bakedKeysByConfigDir.set(target.configDir, target.buildArgsFromEnv ?? []);
}

let failed = false;

for (const leaf of await readdir('services')) {
  const contract = await loadEnvContract(join('services', leaf, 'env-contract.generated.json'));

  if (contract === null) {
    continue;
  }

  const sources: Array<EnvKeySource> = [
    await readEnvFileSource(join('services', leaf, '.env.development')),
  ];

  const exampleSource = await findEnvFileSource(join('services', leaf, '.env.example'));

  if (exampleSource !== null) {
    sources.push(exampleSource);
  }

  const bakedKeys = bakedKeysByConfigDir.get(join('services', leaf)) ?? [];

  for (const stack of COMPOSE_STACKS) {
    const composeSource = await readComposeSource(stack, `service-${leaf}`, bakedKeys);

    if (composeSource === null) {
      console.error(`✗ service-${leaf} is not defined in ${stack.file}`);

      failed = true;
      continue;
    }

    sources.push(composeSource);
  }

  for (const gap of findEnvGaps(contract.required, sources)) {
    console.error(`✗ service-${leaf}: ${gap.label} is missing ${gap.missing.join(', ')}`);

    failed = true;
  }
}

if (failed) {
  console.error('run `bun run env:contract` and add the missing keys to each flagged file');

  process.exitCode = 1;
} else {
  console.log('✓ every service env contract is covered by its dev, example, and stack env');
}

async function readEnvFileSource(path: string): Promise<EnvKeySource> {
  const source = await readFile(path, 'utf8');

  return { available: new Set(parseEnvKeys(source)), label: path };
}

async function findEnvFileSource(path: string): Promise<EnvKeySource | null> {
  try {
    return await readEnvFileSource(path);
  } catch {
    return null;
  }
}

async function readComposeSource(
  stack: ComposeStack,
  serviceName: string,
  bakedKeys: ReadonlyArray<string>,
): Promise<EnvKeySource | null> {
  const compose = collectComposeEnvKeys(composeDocs.get(stack.file), serviceName);

  if (compose === null) {
    return null;
  }

  const available = new Set([...compose.keys, ...bakedKeys]);

  for (const ref of compose.envFileRefs) {
    const source = await readFile(join(stack.dir, ref), 'utf8');

    for (const key of parseEnvKeys(source)) {
      available.add(key);
    }
  }

  return { available, label: stack.file };
}
