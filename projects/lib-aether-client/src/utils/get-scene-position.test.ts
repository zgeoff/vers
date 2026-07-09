import { expect, test } from 'bun:test';
import type { VectorTuple } from '../types';
import { getScenePosition } from './get-scene-position';

interface TestData {
  input: [number, number];
  vector3: VectorTuple;
}

test.each<TestData>([
  { input: [0, 0], vector3: [0, 0, 0] },
  { input: [1, 2], vector3: [10, 20, 0] },
  { input: [-3, 4], vector3: [-30, 40, 0] },
])('it returns a vector3 of the $input position scaled as expected', (data) => {
  const result = getScenePosition(data.input);

  expect(result[0]).toBe(data.vector3[0]);
  expect(result[1]).toBe(data.vector3[1]);
  expect(result[2]).toBe(data.vector3[2]);
});
