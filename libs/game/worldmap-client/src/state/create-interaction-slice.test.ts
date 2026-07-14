import { expect, test } from 'bun:test';
import { createInteractionSlice } from './create-interaction-slice';

test('it builds the empty interaction state', () => {
  expect(createInteractionSlice()).toStrictEqual({
    hoveredNode: null,
    selectedNode: null,
    selectedObject3D: null,
  });
});
