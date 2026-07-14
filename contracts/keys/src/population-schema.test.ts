import { expect, test } from 'bun:test';
import { PopulationSchema } from './population-schema';

test('it accepts every declared population value', () => {
  for (const population of ['trade', 'self-found']) {
    expect(PopulationSchema.safeParse(population).success).toBeTrue();
  }
});

test('it rejects a population outside the enum', () => {
  const result = PopulationSchema.safeParse('rogue');

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: [] }));
});
