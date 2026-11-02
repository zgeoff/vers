import path from 'node:path';
import { runInfraStep } from '../infra/run-infra-step';
import { requireEnvVar } from '../utils/require-env-var';

// Runs one Pulumi step of the infra workflows, named in STEP, on the prod stack of the program in
// INFRA_PATH, with the secrets in its .env.example, and adds its output to the step summary. Needs
// OP_SERVICE_ACCOUNT_TOKEN.

const result = await runInfraStep({
  infraPath: path.resolve(requireEnvVar('INFRA_PATH', 'the step runs the program there')),
  stepName: requireEnvVar('STEP', 'it names the Pulumi step to run'),
  summaryPath: requireEnvVar('GITHUB_STEP_SUMMARY', 'the output goes in the step summary'),
});

process.stdout.write(result.output);

process.exitCode = result.exitCode;
