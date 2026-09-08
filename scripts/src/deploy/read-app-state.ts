import { runFlyctl } from '../utils/run-flyctl';
import { parseAppState } from './parse-app-state';
import type { AppState } from './types';

interface ReadAppStateOptions {
  readonly cancelSignal?: AbortSignal;
}

export async function readAppState(app: string, options?: ReadAppStateOptions): Promise<AppState> {
  const stdout = await runFlyctl(['machines', 'list', '--app', app, '--json'], options);

  return parseAppState(JSON.parse(stdout));
}
