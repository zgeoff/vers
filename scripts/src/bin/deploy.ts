import { Command } from 'commander';
import { execa } from 'execa';
import invariant from 'tiny-invariant';
import { applyDeploy } from '../deploy/apply-deploy';
import { applyScheduledMachineActions } from '../deploy/apply-scheduled-machine-actions';
import { checkTarget } from '../deploy/check-target';
import { findStaleReason } from '../deploy/find-stale-reason';
import { loadDeployManifest } from '../deploy/load-deploy-manifest';
import { planScheduledMachineActions } from '../deploy/plan-scheduled-machine-actions';
import { readAppState } from '../deploy/read-app-state';
import { readChangesSince } from '../deploy/read-changes-since';
import { runProbes } from '../deploy/run-probes';
import type { DeployManifest, DeployTarget } from '../deploy/types';
import { waitForDeployedSHA } from '../deploy/wait-for-deployed-sha';

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

await program.parseAsync();

async function runDeploy(app: string): Promise<void> {
  const manifest = await loadDeployManifest();

  const target = requireTarget(manifest, app);

  const sha = await readHeadSHA();
  const state = await readAppState(target.app);

  const changes = state.deployedSHA === null ? null : await readChangesSince(state.deployedSHA);
  const staleReason = findStaleReason(target, changes);

  if (staleReason === null) {
    console.log(`${target.app} is current at ${state.deployedSHA ?? 'unknown'} — skipping`);

    return;
  }

  console.log(`deploying ${target.app} at ${sha} — ${staleReason}`);

  await applyDeploy(target, sha);
  await waitForDeployedSHA(target.app, sha);
  await runScheduledMachineReconcile(target, sha);

  const findings = await runProbes(target.probes ?? []);

  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(`✗ ${target.app} — ${finding}`);
    }

    process.exitCode = 1;
  }
}

/**
 * Reconciles a target's declared scheduled machines against its fleet.
 * Runs only after the rollout's SHA is confirmed, so the fleet's single
 * service image reflects the deploy that just landed rather than a
 * mid-cutover mix.
 */
async function runScheduledMachineReconcile(target: DeployTarget, sha: string): Promise<void> {
  const declarations = target.scheduledMachines ?? [];

  if (declarations.length === 0) {
    return;
  }

  const state = await readAppState(target.app);

  invariant(
    state.serviceImage !== null,
    `${target.app} has no single service image to reconcile scheduled machines against`,
  );

  const actions = planScheduledMachineActions(
    declarations,
    state.serviceImage,
    state.scheduledMachines,
  );

  await applyScheduledMachineActions(target.app, sha, actions);
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
