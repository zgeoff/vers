import { appendFile } from 'node:fs/promises';
import { $ } from 'bun';
import { formatSummarySection } from '../ci/format-summary-section';

interface OutdatedReportOptions {
  readonly cwd: string;
  readonly summaryPath: string;
}

export async function runOutdatedReport(options: Readonly<OutdatedReportOptions>): Promise<string> {
  const report = await $`bun outdated`.cwd(options.cwd).text();

  await appendFile(
    options.summaryPath,
    formatSummarySection({ heading: 'bun outdated', language: '', body: report }),
  );

  return report;
}
