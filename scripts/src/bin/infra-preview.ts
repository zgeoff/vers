import path from 'node:path';
import { runInfraPreview } from '../infra/run-infra-preview';
import { requireEnvVar } from '../utils/require-env-var';

// Previews the prod stack of infra/ with the secrets in infra/.env.example, and keeps the output in
// $RUNNER_TEMP/preview.txt for the summary step. Needs OP_SERVICE_ACCOUNT_TOKEN.

const result = await runInfraPreview({
  infraPath: path.resolve(import.meta.dirname, '../../../infra'),
  outputPath: path.join(
    requireEnvVar('RUNNER_TEMP', 'the summary step reads the preview from there'),
    'preview.txt',
  ),
});

process.stdout.write(result.output);

process.exitCode = result.exitCode;
