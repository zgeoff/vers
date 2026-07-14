import { execFileSync } from 'node:child_process';

/**
 * The current worktree's checked-out branch name.
 */
export function readCurrentBranch(): string {
  return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
}
