import type { ServiceID } from '../types';
import { runDockerCompose } from '../utils/run-docker-compose';

export async function runInService(service: ServiceID, command: Array<string>): Promise<void> {
  await runDockerCompose(['exec', service, ...command]);
}
