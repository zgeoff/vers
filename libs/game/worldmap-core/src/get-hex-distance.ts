export function getHexDistance(
  from: readonly [number, number],
  to: readonly [number, number],
): number {
  const dx = from[0] - to[0];
  const dy = from[1] - to[1];

  return (Math.abs(dx) + Math.abs(dy) + Math.abs(dx + dy)) / 2;
}
