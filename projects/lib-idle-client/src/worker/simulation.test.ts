import { createSimulation } from '@vers/idle-core';
import { afterEach, expect, test } from 'vitest';
import xxhash from 'xxhash-wasm';
import { getSimulation, setSimulation } from './simulation';

const hasher = await xxhash();

afterEach(() => {
  setSimulation(null);
});

test('it sets the current simulation', () => {
  const simulation = createSimulation(hasher);

  setSimulation(simulation);

  const result = getSimulation();

  expect(result).toStrictEqual(simulation);
});
