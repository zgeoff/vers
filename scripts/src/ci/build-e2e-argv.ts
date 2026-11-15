// The matrix passes a leg's Playwright flags as one string, such as `--project=chromium --shard=1/2`,
// and turbo forwards each flag after `--` to the e2e script.
export function buildE2EArgv(projects: string): ReadonlyArray<string> {
  const flags = projects.split(/\s+/u).filter((flag) => flag !== '');

  return ['run', 'e2e', '--affected', '--log-order=stream', '--', ...flags];
}
