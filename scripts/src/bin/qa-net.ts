import { homedir } from 'node:os';
import { define } from 'gunshi';
import { buildChromePaths } from '../qa-chrome/build-chrome-paths';
import { buildRestoreCommands } from '../qa-chrome/build-restore-commands';
import { findDefaultInterface } from '../qa-chrome/find-default-interface';
import { formatChromeRefusal } from '../qa-chrome/format-chrome-refusal';
import { formatNetworkStatus } from '../qa-chrome/format-network-status';
import { formatRouteCount } from '../qa-chrome/format-route-count';
import { pickNetworkTarget } from '../qa-chrome/pick-network-target';
import { probeLinkUp } from '../qa-chrome/probe-link-up';
import { readChromeState } from '../qa-chrome/read-chrome-state';
import { readNamespaceRoutes } from '../qa-chrome/read-namespace-routes';
import { runInNamespace } from '../qa-chrome/run-in-namespace';
import type { ChromeNamespace, ChromeState } from '../qa-chrome/types';
import { writeChromeState } from '../qa-chrome/write-chrome-state';
import { runCommandLine } from '../utils/run-command-line';

const paths = buildChromePaths(process.env['XDG_STATE_HOME'], homedir());

const cutCommand = define({
  name: 'cut',
  description: "take the browser namespace's network interface down",
  run: async () => {
    const target = await readNetworkTarget();

    const holderPID = target.namespace.holderPID;

    if (target.namespace.cut !== null) {
      console.log('the network is already cut; bring it back with bun run qa:net restore');

      return;
    }

    const routes = await readNamespaceRoutes(holderPID);

    const interfaceName = findDefaultInterface(routes);

    if (interfaceName === undefined) {
      console.error('qa-net: the namespace has no default route, so there is no network to cut');
      process.exit(1);
    }

    await writeChromeState(paths, {
      ...target.state,
      namespace: { ...target.namespace, cut: { interfaceName, routes } },
    });

    await runInNamespace(holderPID, ['ip', 'link', 'set', 'dev', interfaceName, 'down']);

    console.log(`✓ cut: ${interfaceName} is down, with ${formatRouteCount(routes.length)} saved`);
  },
});

const restoreCommand = define({
  name: 'restore',
  description: 'bring the interface and its saved routes back',
  run: async () => {
    const target = await readNetworkTarget();

    const cut = target.namespace.cut;

    if (cut === null) {
      console.log('the network is not cut');

      return;
    }

    for (const command of buildRestoreCommands(cut)) {
      await runInNamespace(target.namespace.holderPID, command);
    }

    await writeChromeState(paths, {
      ...target.state,
      namespace: { ...target.namespace, cut: null },
    });

    console.log(
      `✓ restored: ${cut.interfaceName} is up with ${formatRouteCount(cut.routes.length)}`,
    );
  },
});

const statusCommand = define({
  name: 'status',
  description: "print the browser and the state of its namespace's network",
  run: async () => {
    const target = await readNetworkTarget();

    const holderPID = target.namespace.holderPID;
    const cut = target.namespace.cut;
    const isLinkUp = cut === null ? null : await probeLinkUp(holderPID, cut.interfaceName);

    const routes = await readNamespaceRoutes(holderPID);

    console.log(
      formatNetworkStatus({ isLinkUp, namespace: target.namespace, routes, state: target.state }),
    );
  },
});

const entry = define({
  name: 'qa-net',
  description: 'cut and restore the network of the browser that qa:chrome start --netns launched',
});

try {
  const ran = await runCommandLine(process.argv.slice(2), entry, {
    output: console,
    subCommands: { cut: cutCommand, restore: restoreCommand, status: statusCommand },
  });

  if (!ran) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`qa-net: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

async function readNetworkTarget(): Promise<{
  readonly namespace: ChromeNamespace;
  readonly state: ChromeState;
}> {
  const running = await readChromeState(paths);

  const target = pickNetworkTarget(running);

  if (target.kind !== 'ready') {
    console.error(`qa-net: ${formatChromeRefusal(target)}`);
    process.exit(1);
  }

  return target;
}
