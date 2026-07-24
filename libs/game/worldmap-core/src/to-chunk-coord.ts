import { CHUNK_SIZE } from './consts';

/**
 * Maps a cell coordinate to the coordinate of the chunk that owns it. Uses floor division so
 * negative cells fall into the chunk below them rather than rounding toward zero.
 */
export function toChunkCoord(cx: number, cy: number): [number, number] {
  return [Math.floor(cx / CHUNK_SIZE), Math.floor(cy / CHUNK_SIZE)];
}
