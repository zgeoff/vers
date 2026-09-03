import * as z from 'zod';
import { runFlyctl } from '../utils/run-flyctl';

const secretListSchema = z.array(z.looseObject({ name: z.string() }));

export async function readFlySecretNames(app: string): Promise<Array<string>> {
  const stdout = await runFlyctl(['secrets', 'list', '--app', app, '--json']);

  return secretListSchema.parse(JSON.parse(stdout)).map((secret) => secret.name);
}
