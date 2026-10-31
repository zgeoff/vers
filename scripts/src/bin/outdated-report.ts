import { runOutdatedReport } from '../dependencies/run-outdated-report';
import { requireEnvVar } from '../utils/require-env-var';

// Prints `bun outdated` for the root, whose catalog holds every external version, and adds it to
// the run's step summary.

const report = await runOutdatedReport({
  cwd: process.cwd(),
  summaryPath: requireEnvVar('GITHUB_STEP_SUMMARY', 'the report goes in the step summary'),
});

process.stdout.write(report);
