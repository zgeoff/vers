interface SwingProgressInput {
  readonly attackSpeed: number;
  readonly elapsed: number;
  readonly isAlive: boolean;
  readonly lastAttackTime: number;
}

export function buildSwingProgress(input: Readonly<SwingProgressInput>): number {
  if (!input.isAlive || input.attackSpeed <= 0) {
    return 0;
  }

  const intervalMS = 1000 / input.attackSpeed;
  const pct = ((input.elapsed - input.lastAttackTime) / intervalMS) * 100;

  return Math.max(0, Math.min(100, pct));
}
