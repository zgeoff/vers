import path from 'node:path';
import { runInfraStep } from '../infra/run-infra-step';
import { requireEnvVar } from '../utils/require-env-var';

const result = await runInfraStep({
  infraPath: path.resolve(requireEnvVar('INFRA_PATH', 'the step runs the program there')),
  stepName: requireEnvVar('STEP', 'it names the Pulumi step to run'),
  summaryPath: requireEnvVar('GITHUB_STEP_SUMMARY', 'the output goes in the step summary'),
});

process.stdout.write(result.output);

process.exitCode = result.exitCode;
