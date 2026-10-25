export function buildKeyPrefixRange(prefix: string): IDBKeyRange {
  // the empty-array upper bound sorts after every number or string second element: IndexedDB
  // orders array keys above number and string keys
  return IDBKeyRange.bound([prefix], [prefix, []]);
}
