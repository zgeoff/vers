import { expect, test } from 'bun:test';
import { createDevSlice } from './create-dev-slice';

test('it builds the default dev-tool state', () => {
  expect(createDevSlice()).toStrictEqual({
    isAxesHelperVisible: false,
    isDevCameraActive: false,
    isFogOfWarVisible: true,
  });
});
