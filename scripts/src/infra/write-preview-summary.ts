import { appendFile, readFile } from 'node:fs/promises';
import { formatSummarySection } from '../ci/format-summary-section';

interface PreviewSummaryOptions {
  readonly outputPath: string;
  readonly summaryPath: string;
}

export async function writePreviewSummary(options: Readonly<PreviewSummaryOptions>): Promise<void> {
  const output = await readFile(options.outputPath, 'utf8').catch((error: unknown) => {
    if (isMissingFileError(error)) {
      return 'the preview step wrote no output';
    }

    throw error;
  });

  await appendFile(
    options.summaryPath,
    formatSummarySection({ heading: 'Pulumi preview (prod)', language: 'text', body: output }),
  );
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
