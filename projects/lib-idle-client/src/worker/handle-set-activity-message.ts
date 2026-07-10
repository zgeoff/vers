import type { SetActivityMessage } from '../types';
import type { WorkerContext } from './types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- WorkerContext's `connections` field is a ReadonlySet, which this rule doesn't recognize as a readonly type
export function handleSetActivityMessage(context: WorkerContext, message: SetActivityMessage) {
  const simulation = context.getSimulation();

  if (!simulation) {
    console.warn('-- tried setting activity but no simulation');

    return;
  }

  simulation.startActivity(message.avatar, message.activity);
}
