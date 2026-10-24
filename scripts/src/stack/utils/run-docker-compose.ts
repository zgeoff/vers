import { DOCKER_COMPOSE_FILE } from '../consts';

export async function runDockerCompose(args: ReadonlyArray<string>): Promise<void> {
  const compose = Bun.spawn(['docker', 'compose', '-f', DOCKER_COMPOSE_FILE, ...args], {
    // without an env, Bun.spawn looks docker up on the PATH Bun started with, not the live one
    env: process.env,
    stdio: ['inherit', 'inherit', 'inherit'],
  });

  const exitCode = await compose.exited;

  if (exitCode !== 0) {
    throw new Error(`docker compose ${args.join(' ')} exited with code ${exitCode}`);
  }
}
