/**
 * Number of steps between two axial hex cells — the cube-coordinate distance, where the third axis
 * is `-cx - cy`. This is the ring count difficulty measures against.
 */
export function getHexDistance(a: readonly [number, number], b: readonly [number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];

  return (Math.abs(dx) + Math.abs(dy) + Math.abs(dx + dy)) / 2;
}
