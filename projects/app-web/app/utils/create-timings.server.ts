import type { Timings } from '../types';

/**
 * Creates a new Timings object including the given metric for the given type and description.
 * @param type - The type of the timing metric.
 * @param description - The description of the timing metric.
 * @returns The new Timings object.
 */
export function createTimings(type: string, description?: string) {
  const timings: Timings = {
    [type]: [{ description, start: performance.now() }],
  };

  return timings;
}
