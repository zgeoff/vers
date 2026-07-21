/**
 * Whether this runtime exposes a usable Web Locks API. False on the server, in browsers that lack
 * it, and under test DOMs that declare the property as null.
 */
export function isWebLocksSupported(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  // widened: outside real browsers the property can be absent or a bare null placeholder
  const locks: LockManager | null | undefined = navigator.locks;

  return locks !== null && locks !== undefined;
}
