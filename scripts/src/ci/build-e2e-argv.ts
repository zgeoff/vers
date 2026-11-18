export function buildE2EArgv(projects: string): ReadonlyArray<string> {
  const flags = projects.split(/\s+/u).filter((flag) => flag !== '');

  return ['run', 'e2e', '--affected', '--log-order=stream', '--', ...flags];
}
