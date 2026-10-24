import { runDockerCompose } from '../utils/run-docker-compose';

export async function printStatus(): Promise<void> {
  await runDockerCompose(['ps', '--all']);
}
