/**
 * Gets the rectangle coordinates of a node by converting it's polar coordinates.
 *
 * @param i - The index of the node in it's difficulty level (used to determine the angle)
 * @param difficulty - The difficulty of the node (used to determine the radius)
 * @returns The [X, Y] coordinates of the node
 */
export function getNodePosition(i: number, difficulty: number): [number, number] {
  if (i === 0 && difficulty === 0) {
    return [0, 0];
  }

  const segments = difficulty * 4;
  const segmentRadians = (2 * Math.PI) / segments;

  // add 0 to ensure -0 becomes 0.
  const x = Number((difficulty * Math.cos(segmentRadians * i)).toFixed(3)) + 0;
  const y = Number((difficulty * Math.sin(segmentRadians * i)).toFixed(3)) + 0;

  return [x, y];
}
