import { join } from 'node:path';
import { runVerify } from '@wringer/gunshi';
import { chromium } from 'playwright-core';
import { createVerifyRegistry } from './create-verify-registry';
import { readFreePort } from './local/read-free-port';

// The run's supervisor is this file started again with this environment, so the Chromium it
// launches and the game driver it holds agree on one DevTools port.
process.env['VERS_VERIFY_CHROMIUM'] ??= chromium.executablePath();
process.env['VERS_VERIFY_DEVTOOLS_PORT'] ??= String(readFreePort());

await runVerify(
  createVerifyRegistry({
    chromiumLauncher: join(import.meta.dir, 'game', 'launch-chromium.sh'),
    devtoolsPort: Number(process.env['VERS_VERIFY_DEVTOOLS_PORT']),
  }),
  { skill: '.claude/skills/verify' },
);
