import { parseRoutes } from './parse-routes';
import { runInNamespace } from './run-in-namespace';
import type { SavedRoute } from './types';

export async function readNamespaceRoutes(holderPID: number): Promise<Array<SavedRoute>> {
  const [inet, inet6] = await Promise.all([
    runInNamespace(holderPID, ['ip', '-j', '-4', 'route', 'show']),
    runInNamespace(holderPID, ['ip', '-j', '-6', 'route', 'show']),
  ]);

  return [...parseRoutes(inet, 'inet'), ...parseRoutes(inet6, 'inet6')];
}
