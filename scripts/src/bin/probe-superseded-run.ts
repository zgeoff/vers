import { appendFile } from 'node:fs/promises';
import { probeNewerRun } from '../ci/probe-newer-run';
import { requireEnvVar } from '../utils/require-env-var';

// the runner sets GITHUB_API_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID and GITHUB_OUTPUT in every step
const reason = 'the newer-run step reads its run from them';

const isSuperseded = await probeNewerRun({
  apiURL: requireEnvVar('GITHUB_API_URL', reason),
  repository: requireEnvVar('GITHUB_REPOSITORY', reason),
  runID: requireEnvVar('GITHUB_RUN_ID', reason),
  token: requireEnvVar('GITHUB_TOKEN', 'the newer-run step passes it through env'),
});

await appendFile(
  requireEnvVar('GITHUB_OUTPUT', 'the outcome goes in the step outputs'),
  `superseded=${String(isSuperseded)}\n`,
);

const summary = isSuperseded
  ? 'a newer run of this workflow exists, so this run skips the deploy stages'
  : 'no newer run of this workflow exists, so this run deploys';

console.log(summary);
