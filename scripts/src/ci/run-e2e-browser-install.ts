import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { $ } from 'bun';

interface BrowserInstallOptions {
  readonly aptConfigPath: string;
  readonly archivesPath: string;
  readonly browsers: ReadonlyArray<string>;
  readonly user: string;
}

// The runner's Ubuntu mirror serves the browsers' system packages at a few hundred kB/s on some
// runs, so apt keeps its downloads in a folder that the job caches between runs.
export async function runE2EBrowserInstall(
  options: Readonly<BrowserInstallOptions>,
): Promise<void> {
  await mkdir(path.join(options.archivesPath, 'partial'), { recursive: true });

  const aptConfig = [
    `Dir::Cache::Archives "${options.archivesPath}";`,
    'APT::Keep-Downloaded-Packages "true";',
    'Acquire::Retries "3";',
    '',
  ].join('\n');

  await $`sudo tee ${options.aptConfigPath} < ${new Response(aptConfig)}`.quiet();

  await $`bun run playwright install --with-deps --only-shell ${options.browsers}`;
  await $`sudo chown -R ${options.user} ${options.archivesPath}`;
}
