export function buildCheckpointArchiveKey(avatarID: string, activityID: string): string {
  return `checkpoints/${encodeURIComponent(avatarID)}/${encodeURIComponent(activityID)}.jsonl.gz`;
}
