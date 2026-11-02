import { rm } from 'node:fs/promises';
import { homedir, userInfo } from 'node:os';
import { define } from 'gunshi';
import { buildChromeCommand } from '../qa-chrome/build-chrome-command';
import { buildChromePaths } from '../qa-chrome/build-chrome-paths';
import { createChrome } from '../qa-chrome/create-chrome';
import { formatChromeRefusal } from '../qa-chrome/format-chrome-refusal';
import { pickStartPlan } from '../qa-chrome/pick-start-plan';
import { probeDevToolsEndpoint } from '../qa-chrome/probe-devtools-endpoint';
import { QA_CHROME_ARGS } from '../qa-chrome/qa-chrome-args';
import { readChromeState } from '../qa-chrome/read-chrome-state';
import { removeProcessGroup } from '../qa-chrome/remove-process-group';
import { STATE_LOCK_WAIT_MS } from '../qa-chrome/state-lock-wait-ms';
import { STOP_GRACE_MS } from '../qa-chrome/stop-grace-ms';
import type { ChromeRefusal } from '../qa-chrome/types';
import { withChromeStateLock } from '../qa-chrome/with-chrome-state-lock';
import { writeChromeState } from '../qa-chrome/write-chrome-state';
import { runCommandLine } from '../utils/run-command-line';

const paths = buildChromePaths(process.env['XDG_STATE_HOME'], homedir());

const startCommand = define({
  name: 'start',
  description: 'launch a headless Chromium with its own profile and a DevTools port',
  args: QA_CHROME_ARGS.start,
  run: (ctx) =>
    withChromeStateLock(paths, STATE_LOCK_WAIT_MS, async () => {
      const options = ctx.values;

      const running = await readChromeState(paths);

      const plan = pickStartPlan({
        chromiumPath: Bun.which('chromium'),
        isNetns: options.netns,
        pastaPath: Bun.which('pasta'),
        running,
        tmpdir: process.env['TMPDIR'] ?? '/tmp',
      });

      if (plan.kind !== 'launch') {
        refuse(plan);
      }

      const isPortBusy = await probeDevToolsEndpoint(options.port);

      if (isPortBusy) {
        refuse({ kind: 'port-busy', port: options.port });
      }

      const user = userInfo();

      const command = buildChromeCommand({
        chromiumPath: plan.chromiumPath,
        namespace:
          plan.pastaPath === null
            ? null
            : { gid: user.gid, pastaPath: plan.pastaPath, uid: user.uid },
        port: options.port,
        profileDir: paths.profileDir,
      });

      const state = await createChrome({
        command,
        isNetns: plan.pastaPath !== null,
        paths,
        port: options.port,
      });

      await writeChromeState(paths, state).catch(async (error: unknown) => {
        await removeProcessGroup(state.leaderPID, STOP_GRACE_MS);

        throw error;
      });

      const place = options.netns ? 'in its own network namespace' : 'on the host network';

      console.log(`✓ Chromium runs ${place}, process group ${state.leaderPID}`);
      console.log(`  DevTools: 127.0.0.1:${state.port} (QA_CDP_ENDPOINT=127.0.0.1:${state.port})`);
      console.log(`  profile: ${paths.profileDir}`);
      console.log(`  log: ${paths.logFile}`);
    }),
});

const stopCommand = define({
  name: 'stop',
  description: 'stop the browser that qa:chrome start launched',
  args: QA_CHROME_ARGS.stop,
  run: () => withChromeStateLock(paths, STATE_LOCK_WAIT_MS, stopChrome),
});

const entry = define({
  name: 'qa-chrome',
  description: 'run a debug Chromium for manual QA, optionally in a network namespace',
});

try {
  const ran = await runCommandLine(process.argv.slice(2), entry, {
    output: console,
    subCommands: { start: startCommand, stop: stopCommand },
  });

  if (!ran) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`qa-chrome: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

async function stopChrome(): Promise<void> {
  const running = await readChromeState(paths);

  if (running === undefined) {
    refuse({ kind: 'no-browser' });
  }

  await removeProcessGroup(running.leaderPID, STOP_GRACE_MS);
  await rm(paths.stateFile, { force: true });

  console.log(`✓ stopped the browser, process group ${running.leaderPID}`);
}

function refuse(refusal: ChromeRefusal): never {
  console.error(`qa-chrome: ${formatChromeRefusal(refusal)}`);
  process.exit(1);
}
