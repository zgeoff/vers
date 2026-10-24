import type { ServiceID } from '../types';
import { runDockerCompose } from '../utils/run-docker-compose';

export interface StartOptions {
  build?: boolean;
  forceRecreate?: boolean;
}

export async function start(service?: ServiceID, options?: StartOptions): Promise<void> {
  const args = [];

  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  if (options?.build) {
    args.push('--build');
  }

  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  if (options?.forceRecreate) {
    args.push('--force-recreate');
  }

  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  if (service) {
    args.push(service);
  }

  await runDockerCompose(['up', '--detach', ...args]);
}
