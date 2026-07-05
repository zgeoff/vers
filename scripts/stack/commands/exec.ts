import type { ServiceID } from '@vers/service-types';
import { execa } from '../../utils/execa';
import { DOCKER_COMPOSE_FILE } from '../consts';

export async function exec(
  service: ServiceID,
  command: Array<string>,
): Promise<void> {
  await execa`docker-compose -f ${DOCKER_COMPOSE_FILE} exec ${service} ${command}`;
}
