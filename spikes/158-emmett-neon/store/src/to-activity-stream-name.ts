/** Stream-per-activity naming: emmett derives the stream type from the prefix. */
export function toActivityStreamName(activityId: string): string {
  return `activity:${activityId}`;
}
