import { Collection } from '@msw/data';
import * as db from './index';

export function resetMockDB(): void {
  for (const value of Object.values(db)) {
    if (value instanceof Collection) {
      value.clear();
    }
  }
}
