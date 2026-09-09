import { WorkerMessageType } from '../types';
import type { WorkerContext } from './types';
import type { SimulationSpeedStatus } from './worker-contract';
import type { WorkerMessage } from './worker-to-client-message-schema';

interface SetSimulationSpeedInput {
  readonly isQAAvatar: boolean;
  readonly speed: number;
}

export function handleSetSimulationSpeedMessage(
  context: WorkerContext,
  input: Readonly<SetSimulationSpeedInput>,
): SimulationSpeedStatus {
  if (input.speed > 1 && !input.isQAAvatar) {
    return { kind: 'refused', reason: 'avatar-not-qa' };
  }

  context.setSimulationSpeed(input.speed);
  context.getDebugRecorder().recordEvent('speed', String(input.speed));

  const statusMessage = {
    speed: input.speed,
    type: WorkerMessageType.SimulationSpeedStatus,
  } satisfies WorkerMessage;

  context.broadcast(statusMessage);

  return { kind: 'applied', speed: input.speed };
}
