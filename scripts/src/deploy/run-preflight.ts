import { readCurrentContentVersion } from '@vers/content-registry';
import { createDB } from '@vers/db';
import { readCurrentSimVersion } from '@vers/sim-registry';
import { findEnvGaps } from '../env/find-env-gaps';
import { loadEnvContract } from '../env/load-env-contract';
import { requireEnvVar } from '../utils/require-env-var';
import { findContentCoverageGap } from './find-content-coverage-gap';
import { loadDeployManifest } from './load-deploy-manifest';
import { readFlyEnvKeys } from './read-fly-env-keys';
import { readFlySecrets } from './read-fly-secrets';

export async function runPreflight(): Promise<void> {
  const manifest = await loadDeployManifest();

  let failed = false;

  for (const target of manifest.apps) {
    const contract = await loadEnvContract(`${target.configDir}/env-contract.generated.json`);

    if (contract === null) {
      if (target.configDir.startsWith('services/')) {
        console.error(
          `✗ ${target.app} — ${target.configDir}/env-contract.generated.json is unreadable`,
        );

        failed = true;
      }

      continue;
    }

    const [envKeys, secrets] = await Promise.all([
      readFlyEnvKeys(target.configDir),
      readFlySecrets(target.app),
    ]);

    const available = new Set([
      ...envKeys,
      ...secrets.map((secret) => secret.name),
      ...(target.buildArgsFromEnv ?? []),
    ]);

    const gaps = findEnvGaps(contract.required, [{ available, label: target.app }]);

    if (gaps.length === 0) {
      console.log(`✓ ${target.app} — required env covered`);
      continue;
    }

    failed = true;

    for (const gap of gaps) {
      console.error(
        `✗ ${target.app} — missing from fly.toml [env], secrets, and baked build args: ${gap.missing.join(', ')}`,
      );
    }
  }

  if (failed) {
    console.error(
      'cover the missing keys with `flyctl secrets set`, a fly.toml [env] entry, or a baked build arg (buildArgsFromEnv) before deploying',
    );

    process.exitCode = 1;
  }

  await runContentCoveragePreflight();
}

// a content publish that outruns the engine strands every start at SIM_VERSION_EXPIRED; the
// preflight checks the ordering the activity admission assumes
async function runContentCoveragePreflight(): Promise<void> {
  const databaseURL = requireEnvVar(
    'DATABASE_URL',
    'the content coverage preflight reads the sim-version and content registries',
  );

  const db = createDB({ databaseURL });

  try {
    const [engine, currentContentVersion] = await Promise.all([
      readCurrentSimVersion(db),
      readCurrentContentVersion(db),
    ]);

    const gap = findContentCoverageGap({
      contentVersion: currentContentVersion,
      maxContentVersion: engine?.maxContentVersion,
    });

    if (gap === null) {
      console.log('✓ content coverage — the active engine covers the current content version');

      return;
    }

    console.error(`✗ content coverage — ${gap}`);

    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}
