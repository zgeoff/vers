import type { ServiceID } from '@vers/service-types';
import { execa } from '../../utils/execa';
import { DOCKER_COMPOSE_FILE } from '../consts';

export interface StartOptions {
  build?: boolean;
  forceRecreate?: boolean;
}

export async function start(service?: ServiceID, options?: StartOptions): Promise<void> {
  const args = [];

  if (options?.build) {
    args.push('--build');
  }

  if (options?.forceRecreate) {
    args.push('--force-recreate');
  }

  if (service) {
    args.push(service);
  }

  await execa`docker-compose -f ${DOCKER_COMPOSE_FILE} up --detach ${args}`;
}
