import { PER_MILLE } from './per-mille';

export function toAttacksPerSecond(speedPerMille: number): number {
  return speedPerMille / PER_MILLE;
}
