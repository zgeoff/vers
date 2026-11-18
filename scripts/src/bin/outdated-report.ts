import { runOutdatedReport } from '../dependencies/run-outdated-report';
import { requireEnvVar } from '../utils/require-env-var';

const report = await runOutdatedReport({
  cwd: process.cwd(),
  summaryPath: requireEnvVar('GITHUB_STEP_SUMMARY', 'the report goes in the step summary'),
});

process.stdout.write(report);
