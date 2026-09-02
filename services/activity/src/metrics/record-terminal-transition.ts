import { metrics } from '@opentelemetry/api';

export type TerminalTransitionStatus = 'capped' | 'stopped';

export function recordTerminalTransition(status: TerminalTransitionStatus): void {
  // resolved through the global metrics API on every call — the SDK returns the same instrument
  // for an identical registration, and resolving late keeps the counter bound to whichever meter
  // provider the process registered at boot; without one it is the API's no-op
  const counter = metrics
    .getMeter('@vers/service-activity')
    .createCounter('vers.activity.terminal_transitions', {
      description: 'activities that claimed a terminal transition, by status',
      unit: '{activity}',
    });

  counter.add(1, { status });
}
