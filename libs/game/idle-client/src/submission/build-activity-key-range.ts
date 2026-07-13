/**
 * The `[activityID, version]` key range spanning every version of one activity, in ascending
 * version order — the empty-array upper bound sorts after any finite version, since IndexedDB
 * orders the array key type above the number key type.
 */
export function buildActivityKeyRange(activityID: string): IDBKeyRange {
  return IDBKeyRange.bound([activityID], [activityID, []]);
}
