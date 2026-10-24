interface BackupBranchNameInput {
  readonly commitSHA: string;
  readonly runID: string;
  readonly runAttempt: string;
}

export function buildBackupBranchName(input: BackupBranchNameInput): string {
  return `pre-migrate-${input.commitSHA.slice(0, 12)}-run-${input.runID}-${input.runAttempt}`;
}
