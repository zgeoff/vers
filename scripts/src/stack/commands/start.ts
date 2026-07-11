import { execa } from '../../utils/execa';
import { DOCKER_COMPOSE_FILE } from '../consts';
import type { ServiceID } from '../types';

export interface StartOptions {
  build?: boolean;
  forceRecreate?: boolean;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
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

  await execa`docker-compose -f ${DOCKER_COMPOSE_FILE} up --detach ${args}`;
}
