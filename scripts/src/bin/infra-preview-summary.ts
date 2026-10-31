import path from 'node:path';
import { writePreviewSummary } from '../infra/write-preview-summary';
import { requireEnvVar } from '../utils/require-env-var';

// Adds the prod stack preview that the preview step kept to the run's step summary, even when the
// preview step failed before it wrote any output.

await writePreviewSummary({
  outputPath: path.join(
    requireEnvVar('RUNNER_TEMP', 'the preview step keeps its output there'),
    'preview.txt',
  ),
  summaryPath: requireEnvVar('GITHUB_STEP_SUMMARY', 'the preview goes in the step summary'),
});
