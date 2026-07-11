import { runFlyctl } from '../utils/run-flyctl';
import { parseAppState } from './parse-app-state';
import type { AppState } from './types';

export async function readAppState(app: string): Promise<AppState> {
  const stdout = await runFlyctl(['machines', 'list', '--app', app, '--json']);

  return parseAppState(JSON.parse(stdout));
}
