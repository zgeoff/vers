import { execa } from '../../utils/execa';
import { DOCKER_COMPOSE_FILE } from '../consts';
import type { ServiceID } from '../types';

export async function stop(service?: ServiceID): Promise<void> {
  const args = [];

  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  if (service) {
    args.push(service);
  }

  await execa`docker-compose -f ${DOCKER_COMPOSE_FILE} stop ${args}`;
}
