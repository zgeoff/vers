import type { ServiceID } from '../types';
import { runDockerCompose } from '../utils/run-docker-compose';

export async function stop(service?: ServiceID): Promise<void> {
  const args = [];

  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  if (service) {
    args.push(service);
  }

  await runDockerCompose(['stop', ...args]);
}
