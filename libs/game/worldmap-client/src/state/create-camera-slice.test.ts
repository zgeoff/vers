import { expect, test } from 'bun:test';
import { createCameraSlice } from './create-camera-slice';

test('it builds the empty camera state', () => {
  expect(createCameraSlice()).toStrictEqual({
    camera: null,
  });
});
