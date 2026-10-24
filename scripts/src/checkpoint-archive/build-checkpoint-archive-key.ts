export function buildCheckpointArchiveKey(avatarID: string, activityID: string): string {
  return `checkpoints/${avatarID}/${activityID}.jsonl.gz`;
}
