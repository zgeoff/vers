import path from 'node:path';
import { z } from 'zod';
import { runInfraPlanCheck } from '../infra/run-infra-plan-check';
import { requireEnvVar } from '../utils/require-env-var';

// Previews the prod stack of the program in INFRA_PATH, guards the plan, and writes outcome=apply
// or outcome=held to GITHUB_OUTPUT. DRIFT is the drift check's outcome, and EVENT
// workflow_dispatch applies a held plan. Needs OP_SERVICE_ACCOUNT_TOKEN.

const result = await runInfraPlanCheck({
  drift: z
    .enum(['success', 'failure', 'skipped'])
    .parse(requireEnvVar('DRIFT', "it holds the drift check's outcome")),
  event: requireEnvVar('EVENT', 'a manual dispatch applies a held plan'),
  infraPath: path.resolve(requireEnvVar('INFRA_PATH', 'the check previews the program there')),
  outputPath: requireEnvVar('GITHUB_OUTPUT', 'the outcome goes in the step outputs'),
  summaryPath: requireEnvVar('GITHUB_STEP_SUMMARY', 'the report goes in the step summary'),
});

process.stdout.write(result.output);

process.exitCode = result.exitCode;
