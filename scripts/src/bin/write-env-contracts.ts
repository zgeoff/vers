import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildEnvContract } from '@vers/service-runtime';
import type { EnvContract } from '@vers/service-runtime';
import { loadEnvContract } from '../env/load-env-contract';
import { loadEnvShape } from '../env/load-env-shape';
import { renderEnvContract } from '../env/render-env-contract';

const check = process.argv.includes('--check');
let failed = false;

for (const leaf of await readdir('services')) {
  const serviceDir = join('services', leaf);
  const contractPath = join(serviceDir, 'env-contract.generated.json');

  const shape = await loadEnvShape(serviceDir);

  const contract = buildEnvContract(shape);

  const committed = await loadEnvContract(contractPath);

  if (committed !== null && compareEnvContract(committed, contract)) {
    continue;
  }

  if (check) {
    console.error(
      `✗ ${contractPath} does not match the service's env shape — run \`bun run env:contract\` and commit the result`,
    );

    failed = true;
    continue;
  }

  await writeFile(contractPath, renderEnvContract(contract));

  console.log(`wrote ${contractPath}`);
}

if (failed) {
  process.exitCode = 1;
} else if (check) {
  console.log('✓ every committed env contract matches its service env shape');
}

/**
 * Key-list equality between the committed artifact and the freshly derived contract; formatting
 * never participates, so the repo formatter may restyle the artifact freely.
 */
function compareEnvContract(committed: EnvContract, contract: EnvContract): boolean {
  return JSON.stringify(committed) === JSON.stringify(contract);
}
