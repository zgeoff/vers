const ARCHIVE_KEY_PATTERN = /^checkpoints\/[^/]+\/(?<activityID>[^/]+)\.jsonl\.gz$/u;

export function findArchivedActivityID(key: string): string | undefined {
  return ARCHIVE_KEY_PATTERN.exec(key)?.groups?.['activityID'];
}
