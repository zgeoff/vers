import { metrics } from '@opentelemetry/api';

export type TerminalTransitionStatus = 'capped' | 'stopped';

/**
 * Counts one activity that claimed a terminal transition, split by status: `stopped` covers a
 * completed or failed last checkpoint, `capped` covers a batch rejected whole because it exceeded
 * the avatar's accrued simulated-time budget. The counter is resolved through the global metrics
 * API on every call — the SDK returns the same instrument for an identical registration, and
 * resolving late keeps the counter bound to whichever meter provider the process registered at
 * boot; without one it is the API's no-op.
 */
export function recordTerminalTransition(status: TerminalTransitionStatus): void {
  const counter = metrics
    .getMeter('@vers/service-activity')
    .createCounter('vers.activity.terminal_transitions', {
      description: 'activities that claimed a terminal transition, by status',
      unit: '{activity}',
    });

  counter.add(1, { status });
}
