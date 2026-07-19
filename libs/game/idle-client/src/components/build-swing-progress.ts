interface SwingProgressInput {
  readonly attackSpeed: number;
  readonly elapsed: number;
  readonly isAlive: boolean;
  readonly lastAttackTime: number;
}

/**
 * The fill fraction (0–100) of an actor's swing toward its next attack. Returns 0 for the dead and
 * for a zero attack speed (no division by zero), and clamps so an offline catch-up burst that
 * advances elapsed past the next attack can't overshoot the bar.
 */
export function buildSwingProgress(input: Readonly<SwingProgressInput>): number {
  if (!input.isAlive || input.attackSpeed <= 0) {
    return 0;
  }

  const intervalMS = 1000 / input.attackSpeed;
  const pct = ((input.elapsed - input.lastAttackTime) / intervalMS) * 100;

  return Math.max(0, Math.min(100, pct));
}
