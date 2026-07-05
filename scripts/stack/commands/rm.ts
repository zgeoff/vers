import type { ServiceID } from '../../../projects/lib-service-types/src/index';
import { execa } from '../../utils/execa';
import { DOCKER_COMPOSE_FILE } from '../consts';

export async function rm(service?: ServiceID): Promise<void> {
  const args = ['--stop', '--force', '--volumes'];

  if (service) {
    args.push(service);
  }

  await execa`docker-compose -f ${DOCKER_COMPOSE_FILE} rm ${args}`;
}
