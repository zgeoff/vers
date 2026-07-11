import { execa } from '../../utils/execa';
import { DOCKER_COMPOSE_FILE } from '../consts';

export async function status(): Promise<void> {
  await execa`docker-compose -f ${DOCKER_COMPOSE_FILE} ps --all`;
}
