export function buildActivityKeyRange(activityID: string): IDBKeyRange {
  // the empty-array upper bound sorts after every finite version: IndexedDB orders array keys
  // above number keys
  return IDBKeyRange.bound([activityID], [activityID, []]);
}
