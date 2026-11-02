import type { SavedRoute } from './types';

export function findDefaultInterface(routes: ReadonlyArray<SavedRoute>): string | undefined {
  const defaults = routes.filter((route) => route.dst === 'default');

  return (defaults.find((route) => route.family === 'inet') ?? defaults[0])?.dev;
}
