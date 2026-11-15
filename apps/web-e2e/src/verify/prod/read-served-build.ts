import { loadDeployManifest } from '@vers/scripts';
import { readChangesSince } from '@vers/scripts/read-changes-since';
import { WringerError } from '@wringer/core';
import type { HttpClient } from '@wringer/http';
import { $ } from 'bun';
import invariant from 'tiny-invariant';
import { z } from 'zod';
import { pickServedBuildOutcome } from './pick-served-build-outcome';

// a web app deployed before it served its commit answers with `ok` alone
const healthSchema = z.object({
  ok: z.literal(true),
  commit: z
    .string()
    .nullish()
    .transform((commit) => commit ?? null),
});

// Reads the commit the web app serves and checks it against this clone's main, as the doctor's
// served-build check on prod.
export async function readServedBuild(
  http: HttpClient,
): Promise<{ readonly served: string; readonly main: string }> {
  const response = await http.request({ method: 'GET', path: '/health' });

  const health = healthSchema.safeParse(response.json);

  if (!health.success) {
    throw new WringerError('check-failed', {
      message: `GET /health answered ${response.status} with no ok body.`,
    });
  }

  const main = await readMainCommit();

  const served = health.data.commit;
  const changes = served === null ? null : await readChangesSince(served, { head: main });

  const manifest = await loadDeployManifest();

  const web = manifest.apps.find((app) => app.app === 'vers-app-web');

  invariant(web !== undefined, 'deploy.config.ts has no vers-app-web entry');

  const outcome = pickServedBuildOutcome(web, { served, main, changes });

  if (outcome.kind === 'failed') {
    throw new WringerError('check-failed', {
      message: outcome.message,
      hint: `Run \`git fetch origin main\`. When the check still fails, wait for main's deploy to finish, then run \`bun verify doctor\` again.`,
    });
  }

  return { served: outcome.served, main };
}

const mainRef = 'origin/main';

async function readMainCommit(): Promise<string> {
  const parsed = await $`git rev-parse --verify --end-of-options ${`${mainRef}^{commit}`}`
    .nothrow()
    .quiet();

  if (parsed.exitCode !== 0) {
    throw new WringerError('environment', {
      message: `This clone has no ${mainRef}.`,
      hint: 'Run `git fetch origin main`, then `bun verify doctor` again.',
    });
  }

  return parsed.stdout.toString().trim();
}
