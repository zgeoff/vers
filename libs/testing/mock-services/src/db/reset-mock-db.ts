import { Collection } from '@msw/data';
import * as db from './index';

/**
 * Clears every `@msw/data` collection exported from the db barrel, discarding rows any test wrote.
 * Derives the collection set from the barrel's own exports rather than a hand-maintained list, so a
 * collection added later is swept without a corresponding edit here.
 */
export function resetMockDB(): void {
  for (const value of Object.values(db)) {
    if (value instanceof Collection) {
      value.clear();
    }
  }
}
