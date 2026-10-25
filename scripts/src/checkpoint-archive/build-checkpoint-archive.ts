import type { CheckpointRow } from './types';

export function buildCheckpointArchive(
  rows: ReadonlyArray<CheckpointRow>,
): Uint8Array<ArrayBuffer> {
  const lines = rows.map((row) => `${JSON.stringify(row)}\n`).join('');

  return Bun.gzipSync(lines);
}
