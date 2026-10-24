export function buildAvatarKeyRange(avatarID: string): IDBKeyRange {
  // the empty-array upper bound sorts after every node id: IndexedDB orders array keys above
  // string keys
  return IDBKeyRange.bound([avatarID], [avatarID, []]);
}
