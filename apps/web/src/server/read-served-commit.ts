const commitPattern = /^[0-9a-f]{7,64}$/u;

// Each deploy stamps the commit it ships into the machine's env as GIT_SHA. A run with none, such as
// a local stack, serves no commit.
export function readServedCommit(): string | null {
  const commit = process.env['GIT_SHA'];

  return commit !== undefined && commitPattern.test(commit) ? commit : null;
}
