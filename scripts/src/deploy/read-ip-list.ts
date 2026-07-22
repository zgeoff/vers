import { runFlyctl } from '../utils/run-flyctl';
import { parseIPList } from './parse-ip-list';
import type { AppIP } from './types';

export async function readIPList(app: string): Promise<ReadonlyArray<AppIP>> {
  const stdout = await runFlyctl(['ips', 'list', '-a', app, '--json']);

  return parseIPList(JSON.parse(stdout));
}
