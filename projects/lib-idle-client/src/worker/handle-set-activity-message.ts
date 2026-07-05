import type { SetActivityMessage } from '../types';
import { getSimulation } from './simulation';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function handleSetActivityMessage(message: SetActivityMessage) {
  const simulation = getSimulation();

  if (!simulation) {
    console.warn('-- tried setting activity but no simulation');

    return;
  }

  simulation.startActivity(message.avatar, message.activity);
}
