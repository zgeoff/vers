export function isWebLocksSupported(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  // widened: outside real browsers the property can be absent or a bare null placeholder
  const locks: LockManager | null | undefined = navigator.locks;

  return locks !== null && locks !== undefined;
}
