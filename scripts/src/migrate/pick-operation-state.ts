import { match } from 'ts-pattern';

export function pickOperationState(status: string): 'done' | 'failed' | 'pending' {
  return match(status)
    .with('finished', 'skipped', () => 'done' as const)
    .with('failed', 'error', 'cancelling', 'cancelled', () => 'failed' as const)
    .otherwise(() => 'pending' as const);
}
