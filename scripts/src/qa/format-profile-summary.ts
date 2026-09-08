import type { CPUProfile } from './types';

const ROW_LIMIT = 18;

export function formatProfileSummary(profile: CPUProfile, sampledSeconds: number): string {
  const selfTimeByNode = new Map<number, number>();

  profile.samples.forEach((nodeID, index) => {
    selfTimeByNode.set(
      nodeID,
      (selfTimeByNode.get(nodeID) ?? 0) + (profile.timeDeltas[index] ?? 0),
    );
  });

  const nodesByID = new Map(profile.nodes.map((node) => [node.id, node]));

  const totalMicroseconds = [...selfTimeByNode.values()].reduce((sum, value) => sum + value, 0);

  const rows = [...selfTimeByNode.entries()]
    .toSorted((left, right) => right[1] - left[1])
    .slice(0, ROW_LIMIT)
    .map(([nodeID, microseconds]) => {
      const frame = nodesByID.get(nodeID)?.callFrame;
      const share = totalMicroseconds === 0 ? 0 : (100 * microseconds) / totalMicroseconds;

      const location =
        frame === undefined
          ? `node ${nodeID}`
          : `${frame.functionName || '(anon)'}\t${frame.url.split('/').pop() ?? ''}:${frame.lineNumber}:${frame.columnNumber}`;

      return `${share.toFixed(1)}%\t${(microseconds / 1000).toFixed(0)}ms\t${location}`;
    });

  return [
    `total ${(totalMicroseconds / 1000).toFixed(0)}ms sampled over ${sampledSeconds}s`,
    ...rows,
  ].join('\n');
}
