import { PER_MILLE } from './per-mille';

export function toSpeedPerMille(attacksPerSecond: number): number {
  return Math.round(attacksPerSecond * PER_MILLE);
}
