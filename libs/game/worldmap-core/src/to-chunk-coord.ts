import { CHUNK_SIZE } from './consts';

export function toChunkCoord(cx: number, cy: number): [number, number] {
  return [Math.floor(cx / CHUNK_SIZE), Math.floor(cy / CHUNK_SIZE)];
}
