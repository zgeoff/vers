import type { OPReference } from './types';

export function parseOPReferencePath(path: string): OPReference | null {
  const [location = ''] = path.split('?');

  if (location.includes('$') || location.includes('{')) {
    return null;
  }

  const [vault, item, ...fieldSegments] = location.split('/');

  if (
    vault === undefined ||
    vault === '' ||
    item === undefined ||
    item === '' ||
    fieldSegments.length === 0 ||
    fieldSegments.length > 2 ||
    fieldSegments.includes('')
  ) {
    return null;
  }

  return { field: fieldSegments.join('/'), item, vault };
}
