import path from 'node:path';
import { z } from 'zod';
import { readMainTip } from '../infra/read-main-tip';
import { runInfraPlanCheck } from '../infra/run-infra-plan-check';
import { requireEnvVar } from '../utils/require-env-var';

const result = await runInfraPlanCheck({
  commit: requireEnvVar('COMMIT', "a dispatch applies only the commit at main's tip"),
  drift: z
    .enum(['success', 'failure', 'skipped'])
    .parse(requireEnvVar('DRIFT', "it holds the drift check's outcome")),
  event: requireEnvVar('EVENT', 'a manual dispatch applies a held plan'),
  infraPath: path.resolve(requireEnvVar('INFRA_PATH', 'the check previews the program there')),
  mainTip: await readMainTip(process.cwd()),
  outputPath: requireEnvVar('GITHUB_OUTPUT', 'the outcome goes in the step outputs'),
  summaryPath: requireEnvVar('GITHUB_STEP_SUMMARY', 'the report goes in the step summary'),
});

process.stdout.write(result.output);

process.exitCode = result.exitCode;
