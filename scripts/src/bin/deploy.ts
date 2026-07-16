import { createDB } from '@vers/db';
import type { DB } from '@vers/db';
import { findLatestRelease, recordRelease } from '@vers/release-registry';
import type { ReleaseRow } from '@vers/release-registry';
import { updateExpiredSimVersions } from '@vers/sim-registry';
import { Command } from 'commander';
import { execa } from 'execa';
import type { Kysely } from 'kysely';
import { applyBuild } from '../deploy/apply-build';
import { applyDeploy } from '../deploy/apply-deploy';
import { applyRetentionActions } from '../deploy/apply-retention-actions';
import { applyScheduledMachineActions } from '../deploy/apply-scheduled-machine-actions';
import { applySimVersionActions } from '../deploy/apply-sim-version-actions';
import { buildProviderAppName } from '../deploy/build-provider-app-name';
import { checkParkedApp } from '../deploy/check-parked-app';
import { checkTarget } from '../deploy/check-target';
import { findStaleReason } from '../deploy/find-stale-reason';
import { loadDeployManifest } from '../deploy/load-deploy-manifest';
import { PINNED_BUN_VERSION, loadEngineHash } from '../deploy/load-engine-hash';
import { planRetentionActions } from '../deploy/plan-retention-actions';
import { planScheduledMachineActions } from '../deploy/plan-scheduled-machine-actions';
import { planSimVersionActions } from '../deploy/plan-sim-version-actions';
import { readAppState } from '../deploy/read-app-state';
import { readChangesSince } from '../deploy/read-changes-since';
import { readFleetImage } from '../deploy/read-fleet-image';
import { readProviderAppState } from '../deploy/read-provider-app-state';
import { readSimVersionRow } from '../deploy/read-sim-version-row';
import { runProbes } from '../deploy/run-probes';
import type { DeployManifest, DeployTarget } from '../deploy/types';
import { updateParkedActivities } from '../deploy/update-parked-activities';
import { waitForDeployedSHA } from '../deploy/wait-for-deployed-sha';
import { requireEnvVar } from '../utils/require-env-var';

interface DeployCommandOptions {
  readonly app: string;
}

const program = new Command()
  .name('deploy')
  .description('Deploy and verify the Fly fleet against the repo-root deploy manifest');

program
  .command('deploy')
  .description('deploy an app when its fleet is stale relative to HEAD')
  .requiredOption('--app <name>', 'fly app name from the manifest')
  .action(async (options: DeployCommandOptions) => {
    await runDeploy(options.app);
  });

program
  .command('verify')
  .description('assert every app is online and current; any finding fails the run')
  .action(async () => {
    await runVerify();
  });

program
  .command('list')
  .description('print the manifest app names as JSON')
  .action(async () => {
    const manifest = await loadDeployManifest();

    console.log(JSON.stringify(manifest.apps.map((target) => target.app)));
  });

program
  .command('engine-hash')
  .description('print the canonical sim engine bundle hash')
  .action(async () => {
    const hash = await loadEngineHash();

    console.log(hash);
  });

program
  .command('sweep-replay')
  .description(
    'tombstone expired sim versions, destroy their provider apps, and unpark newly-registered activities',
  )
  .action(async () => {
    await runSweepReplay();
  });

async function runDeploy(app: string): Promise<void> {
  const manifest = await loadDeployManifest();

  const target = requireTarget(manifest, app);

  const sha = await readHeadSHA();
  const state = await readAppState(target.app);

  const changes = state.deployedSHA === null ? null : await readChangesSince(state.deployedSHA);
  const staleReason = findStaleReason(target, changes);

  if (staleReason === null) {
    console.log(`${target.app} is current at ${state.deployedSHA ?? 'unknown'} — skipping`);

    await runScheduledMachineReconcile(target);
    await runSimVersionReconcile(target);

    return;
  }

  console.log(`deploying ${target.app} at ${sha} — ${staleReason}`);

  const databaseURL = requireEnvVar(
    'DATABASE_URL',
    'the release record backing rollback lives in the shared database',
  );

  const db = createDB({ databaseURL });

  try {
    await runRollout(db, target, sha);
  } finally {
    await db.destroy();
  }
}

/**
 * One rollout: build and push the image, cut the fleet over to it, reconcile, probe. Probes
 * passing records the release as the app's next rollback target; probes failing rolls the fleet
 * back to the previous recorded release and leaves the run red either way, so the failure ships
 * forward on a later push instead of a broken release serving meanwhile.
 */
async function runRollout(db: Kysely<DB>, target: DeployTarget, sha: string): Promise<void> {
  await setEngineHashEnv(target);

  const previous = await findLatestRelease(db, target.app);

  const image = target.dockerfile === undefined ? null : await applyBuild(target, sha);

  await applyDeploy(target, sha, image);
  await waitForDeployedSHA(target.app, sha);
  await runScheduledMachineReconcile(target);
  await runSimVersionReconcile(target);

  const findings = await runProbes(target.probes ?? []);

  if (findings.length === 0) {
    await recordRolloutRelease(db, target, sha, image);

    return;
  }

  for (const finding of findings) {
    console.error(`✗ ${target.app} — ${finding}`);
  }

  process.exitCode = 1;

  if (previous === undefined) {
    console.error(
      `✗ ${target.app} — no recorded release to roll back to; the broken release is still serving`,
    );

    return;
  }

  await runRollback(target, previous);
}

/**
 * Records the release the probes just blessed. A target that deploys a stock image has no built
 * ref, so its deployable ref comes from the fleet; a fleet with no single resolved image skips
 * the record rather than store a ref rollback couldn't deploy.
 */
async function recordRolloutRelease(
  db: Kysely<DB>,
  target: DeployTarget,
  sha: string,
  image: string | null,
): Promise<void> {
  const fleetImage = await readFleetImage(target.app);

  const ref = image ?? (fleetImage === null ? null : `${fleetImage.repository}:${fleetImage.tag}`);

  if (ref === null) {
    console.log(`${target.app} has no single fleet image — skipping the release record`);

    return;
  }

  await recordRelease(db, {
    app: target.app,
    gitSHA: sha,
    image: ref,
    imageDigest: fleetImage?.digest ?? null,
  });
}

/**
 * Redeploys the previous recorded release after a failed probe, restamping its own SHA so the
 * fleet reads stale against HEAD and the next push ships the fix. Scheduled machines re-reconcile
 * onto the restored image; the sim-version reconcile is skipped — it pairs the engine hash built
 * from HEAD's source with whatever image the fleet runs, and after a rollback those no longer
 * match.
 */
async function runRollback(target: DeployTarget, previous: ReleaseRow): Promise<void> {
  console.error(`rolling ${target.app} back to ${previous.image} (${previous.gitSha})`);

  await applyDeploy(target, previous.gitSha, previous.image);
  await waitForDeployedSHA(target.app, previous.gitSha);
  await runScheduledMachineReconcile(target);

  const findings = await runProbes(target.probes ?? []);

  if (findings.length === 0) {
    console.error(
      `✓ ${target.app} rolled back to ${previous.gitSha}; fix forward on the next push`,
    );

    return;
  }

  for (const finding of findings) {
    console.error(`✗ ${target.app} after rollback — ${finding}`);
  }

  console.error(
    `✗ ${target.app} — probes fail on the previous release too; the failure predates this deploy`,
  );
}

const SIM_ENGINE_HASH_BUILD_ARG_NAMES = ['SIM_ENGINE_HASH', 'VITE_SIM_ENGINE_HASH'];

/**
 * Computes the engine hash once and stamps it into both build-arg env names
 * a target might forward, when its manifest entry asks for either — the build
 * phase's env-forwarding then picks it up without knowing which name the
 * target's own Dockerfile expects.
 */
async function setEngineHashEnv(target: DeployTarget): Promise<void> {
  const buildArgs = target.buildArgsFromEnv ?? [];

  if (!SIM_ENGINE_HASH_BUILD_ARG_NAMES.some((name) => buildArgs.includes(name))) {
    return;
  }

  const hash = await loadEngineHashOnce();

  for (const name of SIM_ENGINE_HASH_BUILD_ARG_NAMES) {
    process.env[name] = hash;
  }
}

/**
 * Reconciles a target's declared scheduled machines against its fleet,
 * aligning them to the image and SHA the service machines currently agree
 * on. Runs after a rollout's SHA is confirmed and on skipped deploys alike,
 * so a machine created behind the fleet converges on the next push rather
 * than waiting for a commit that redeploys its app. Without a single fleet
 * image to reconcile against nothing happens — the verify pass reports the
 * drift instead.
 */
async function runScheduledMachineReconcile(target: DeployTarget): Promise<void> {
  const declarations = target.scheduledMachines ?? [];

  if (declarations.length === 0) {
    return;
  }

  const state = await readAppState(target.app);

  if (state.serviceImage === null || state.deployedSHA === null) {
    console.log(`${target.app} has no single service image — skipping scheduled machines`);

    return;
  }

  const actions = planScheduledMachineActions(
    declarations,
    state.serviceImage,
    state.scheduledMachines,
  );

  await applyScheduledMachineActions(target.app, state.deployedSHA, actions);
}

/**
 * Runs after the replay target's deploy (and on its skipped-deploy path
 * alike, mirroring the scheduled-machine reconcile) to provision or update
 * the per-version provider app for its just-deployed engine hash and keep
 * the `sim_versions` registry row current. A no-op for every other target.
 */
async function runSimVersionReconcile(target: DeployTarget): Promise<void> {
  if (target.simVersionProvider !== true) {
    return;
  }

  const fleetImage = await readFleetImage(target.app);
  const engineHash = await loadEngineHashOnce();

  const providerApp = buildProviderAppName(engineHash);

  const [registryRow, providerAppState] = await Promise.all([
    readSimVersionRow(engineHash),
    readProviderAppState(providerApp),
  ]);

  const actions = planSimVersionActions({
    bunVersion: PINNED_BUN_VERSION,
    engineHash,
    fleetImage,
    providerAppExists: providerAppState.exists,
    providerMachineExists: providerAppState.hasMachine,
    registryRow,
  });

  await applySimVersionActions(actions);
}

let engineHashPromise: Promise<string> | null = null;

/**
 * Builds the engine bundle hash at most once per CLI run — every caller in a
 * single invocation shares the result. The first call pays a full engine
 * bundle build and throws on a non-pinned Bun version.
 */
function loadEngineHashOnce(): Promise<string> {
  engineHashPromise ??= loadEngineHash();

  return engineHashPromise;
}

async function runVerify(): Promise<void> {
  const manifest = await loadDeployManifest();

  let failed = false;

  for (const target of manifest.apps) {
    const state = await readAppState(target.app);

    const changes = state.deployedSHA === null ? null : await readChangesSince(state.deployedSHA);

    const findings = [
      ...checkTarget(target, state, changes),
      ...(await runProbes(target.probes ?? [])),
      ...(await checkParkedApp(target.app, state)),
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

  if (failed) {
    process.exitCode = 1;
  }
}

/**
 * Runs the replay retention sweep: tombstones every `sim_versions` row past its retention
 * deadline (the current version is always excluded), destroys the tombstoned rows' provider apps,
 * then unparks any activity whose stamped hash the registry now carries as active. Idempotent — a
 * repeat run tombstones nothing already pruned, destroys nothing already gone, and unparks nothing
 * already active.
 */
async function runSweepReplay(): Promise<void> {
  const databaseURL = requireEnvVar(
    'DATABASE_URL',
    'the replay retention sweep reads and writes the shared database',
  );

  const db = createDB({ databaseURL });

  const tombstoned = await updateExpiredSimVersions(db);

  const actions = planRetentionActions(tombstoned);

  await applyRetentionActions(actions);

  const unparked = await updateParkedActivities(db);

  await db.destroy();

  console.log(
    `sweep-replay: tombstoned ${tombstoned.length} sim version(s), destroyed ${actions.length} provider app(s), unparked ${unparked.length} activity(ies)`,
  );
}

function requireTarget(manifest: DeployManifest, app: string): DeployTarget {
  const target = manifest.apps.find((candidate) => candidate.app === app);

  if (target === undefined) {
    const known = manifest.apps.map((candidate) => candidate.app).join(', ');

    throw new Error(`unknown app "${app}" — the manifest declares: ${known}`);
  }

  return target;
}

async function readHeadSHA(): Promise<string> {
  const result = await execa('git', ['rev-parse', 'HEAD']);

  return result.stdout.trim();
}

await program.parseAsync();
