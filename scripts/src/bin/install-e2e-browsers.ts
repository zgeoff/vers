import { homedir } from 'node:os';
import path from 'node:path';
import { define } from 'gunshi';
import { runE2EBrowserInstall } from '../ci/run-e2e-browser-install';
import { requireEnvVar } from '../utils/require-env-var';
import { runCommandLine } from '../utils/run-command-line';

// Installs the Playwright browsers an e2e job runs, with their system packages, on a CI runner. The
// job caches ~/apt-archives, where apt keeps the packages it downloads.

const entry = define({
  name: 'install-e2e-browsers',
  description: 'install Playwright browsers with their system packages through a cached apt folder',
  args: {
    browsers: {
      description: 'the Playwright browsers to install, such as chromium',
      multiple: true,
      required: true,
      type: 'positional',
    },
  },
  run: async (ctx) => {
    await runE2EBrowserInstall({
      aptConfigPath: '/etc/apt/apt.conf.d/90-browser-packages',
      archivesPath: path.join(homedir(), 'apt-archives'),
      browsers: ctx.values.browsers,
      user: requireEnvVar('USER', 'the job user owns the cached apt folder'),
    });
  },
});

const ran = await runCommandLine(process.argv.slice(2), entry, { output: console });

if (!ran) {
  process.exitCode = 1;
}
