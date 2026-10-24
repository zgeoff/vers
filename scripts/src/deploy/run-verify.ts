import { checkParkedApp } from './check-parked-app';
import { checkSharedSecrets } from './check-shared-secrets';
import { checkTarget } from './check-target';
import { loadDeployManifest } from './load-deploy-manifest';
import { planIPPosture } from './plan-ip-posture';
import { readAppState } from './read-app-state';
import { readChangesSince } from './read-changes-since';
import { readFleetRelations } from './read-fleet-relations';
import { readFlySecrets } from './read-fly-secrets';
import { readIPList } from './read-ip-list';
import { runProbes } from './run-probes';
import type { DeployManifest, SharedSecretHolder } from './types';

export async function runVerify(): Promise<void> {
  const manifest = await loadDeployManifest();

  let failed = false;

  for (const target of manifest.apps) {
    const state = await readAppState(target.app);

    const changes = state.deployedSHA === null ? null : await readChangesSince(state.deployedSHA);

    const relations = await readFleetRelations(state);
    const ips = await readIPList(target.app);

    const ipPlan = planIPPosture({ app: target.app, exposure: target.exposure, ips });

    const findings = [
      ...checkTarget(target, state, changes, relations),
      ...(await runProbes(target.probes ?? [])),
      ...(await checkParkedApp(target.app, state)),
      ...ipPlan.violations,
    ];

    if (findings.length === 0) {
      console.log(`✓ ${target.app} — online and current at ${state.deployedSHA ?? 'unknown'}`);
      continue;
    }

    failed = true;

    for (const finding of findings) {
      console.error(`✗ ${target.app} — ${finding}`);
    }
  }

  const holders = await readSharedSecretHolders(manifest);

  const sharedSecretFindings = checkSharedSecrets(holders);

  if (holders.length > 0 && sharedSecretFindings.length === 0) {
    console.log('✓ fleet — every shared secret holds one value');
  }

  for (const finding of sharedSecretFindings) {
    failed = true;

    console.error(`✗ fleet — ${finding}`);
  }

  if (failed) {
    process.exitCode = 1;
  }
}

function readSharedSecretHolders(
  manifest: DeployManifest,
): Promise<ReadonlyArray<SharedSecretHolder>> {
  const declaring = manifest.apps.filter((target) => (target.sharedSecrets ?? []).length > 0);

  return Promise.all(
    declaring.map(async (target) => ({
      app: target.app,
      secrets: await readFlySecrets(target.app),
      sharedSecrets: target.sharedSecrets ?? [],
    })),
  );
}
