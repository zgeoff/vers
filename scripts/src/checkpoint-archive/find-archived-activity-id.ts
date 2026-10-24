const ARCHIVE_KEY_PATTERN = /^checkpoints\/[^/]+\/(?<activityID>[^/]+)\.jsonl\.gz$/u;

export function findArchivedActivityID(key: string): string | undefined {
  const encoded = ARCHIVE_KEY_PATTERN.exec(key)?.groups?.['activityID'];

  if (encoded === undefined) {
    return undefined;
  }

  try {
    return decodeURIComponent(encoded);
  } catch {
    return undefined;
  }
}
