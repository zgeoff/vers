import type { ServiceID } from '../../../projects/lib-service-types/src/index';
import { execa } from '../../utils/execa';
import { DOCKER_COMPOSE_FILE } from '../consts';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export async function exec(service: ServiceID, command: Array<string>): Promise<void> {
  await execa`docker-compose -f ${DOCKER_COMPOSE_FILE} exec ${service} ${command}`;
}
