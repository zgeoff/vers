import { expect, test } from 'vitest';
import { getRadiansFromDegrees } from './get-radians-from-degrees';

test.each([
  { degrees: 0, radians: 0 },
  { degrees: 90, radians: 1.570796326 },
  { degrees: 180, radians: Math.PI },
  { degrees: 360, radians: 6.283185307 },
  { degrees: -45, radians: -0.785398163 },
])('it converts $degrees degrees to $radians radians', (data) => {
  const result = getRadiansFromDegrees(data.degrees);

  expect(result).toBeCloseTo(data.radians, 8);
});
