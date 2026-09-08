import { Command } from 'commander';
import { formatMachineTable } from '../deploy/format-machine-table';
import { loadDeployManifest } from '../deploy/load-deploy-manifest';
import { readAppState } from '../deploy/read-app-state';
import { applyColdPathActions } from '../qa-cold/apply-cold-path-actions';
import { collectFleetRequests } from '../qa-cold/collect-fleet-requests';
import { pickColdPathVerdict } from '../qa-cold/pick-cold-path-verdict';
import { planColdPath } from '../qa-cold/plan-cold-path';
import { readAutoStopMode } from '../qa-cold/read-auto-stop-mode';
import { readOpBackedCredential } from '../qa-cold/read-op-backed-credential';
import { readRecentSpans } from '../qa-cold/read-recent-spans';
import type { ColdPathAction } from '../qa-cold/types';
import { waitForColdFleet } from '../qa-cold/wait-for-cold-fleet';

const GUARD_WINDOW_MINUTES = 10;
const WAIT_TIMEOUT_MS = 180_000;

const AXIOM_CREDENTIAL = {
  envName: 'AXIOM_TOKEN',
  fieldLabels: ['iac-token'],
  itemTitle: 'axiom',
  vault: 'vers-ci',
};

const FLY_CREDENTIAL = {
  envName: 'FLY_API_TOKEN',
  fieldLabels: ['fly-api-token'],
  itemTitle: 'github-actions',
  vault: 'vers-ci',
};

interface ColdCommandOptions {
  readonly dryRun: boolean;
  readonly force: boolean;
  readonly wait: boolean;
}

const program = new Command()
  .name('qa-cold')
  .description(
    'suspend every machine of the manifest fleet for cold-path QA, only while the fleet is idle',
  )
  .option('--wait', 'poll until every machine reports suspended or stopped', false)
  .option('--dry-run', 'print the guard verdict and the planned actions without acting', false)
  .option('--force', 'skip the traffic guard; refused for the production fleet', false)
  .action(async (options: ColdCommandOptions) => {
    if (options.force) {
      console.error(
        'qa-cold: --force is refused for the production fleet, and deploy.config.ts names only production apps',
      );

      process.exit(2);
    }

    const manifest = await loadDeployManifest();
    const axiomToken = await readOpBackedCredential(AXIOM_CREDENTIAL);
    const spans = await readRecentSpans(axiomToken, GUARD_WINDOW_MINUTES);

    const verdict = pickColdPathVerdict(collectFleetRequests(spans));

    if (verdict.kind === 'active') {
      console.error(
        `qa-cold: refusing — ${verdict.count} request(s) reached the fleet in the last ${GUARD_WINDOW_MINUTES} minutes`,
      );

      for (const route of verdict.routes) {
        console.error(`  ${String(route.count).padStart(5)}  ${route.route}`);
      }

      process.exit(1);
    }

    console.log(`✓ no request reached the fleet in the last ${GUARD_WINDOW_MINUTES} minutes`);

    process.env['FLY_API_TOKEN'] = await readOpBackedCredential(FLY_CREDENTIAL);

    const actions: Array<ColdPathAction> = [];

    for (const target of manifest.apps) {
      const [state, mode] = await Promise.all([
        readAppState(target.app),
        readAutoStopMode(target.configDir),
      ]);

      actions.push(...planColdPath(target.app, state.machines, mode));
    }

    if (actions.length === 0) {
      console.log('✓ every machine is already cold');
    }

    if (options.dryRun) {
      for (const action of actions) {
        console.log(`would ${action.kind} machine ${action.machineID} (${action.app})`);
      }

      return;
    }

    await applyColdPathActions(actions);

    if (options.wait) {
      await waitForColdFleet(
        manifest.apps.map((target) => target.app),
        WAIT_TIMEOUT_MS,
      );
    }

    for (const target of manifest.apps) {
      const state = await readAppState(target.app);

      console.log(`\n${target.app}`);
      console.log(formatMachineTable(state.machines));
    }
  });

try {
  await program.parseAsync();
} catch (error) {
  console.error(`qa-cold: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
