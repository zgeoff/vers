import * as z from 'zod';
import { runFlyctl } from '../utils/run-flyctl';
import type { FlySecret } from './types';

const secretListSchema = z.array(z.looseObject({ digest: z.string(), name: z.string() }));

export async function readFlySecrets(app: string): Promise<ReadonlyArray<FlySecret>> {
  const stdout = await runFlyctl(['secrets', 'list', '--app', app, '--json']);

  return secretListSchema
    .parse(JSON.parse(stdout))
    .map((secret) => ({ digest: secret.digest, name: secret.name }));
}
