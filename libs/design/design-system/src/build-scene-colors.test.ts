import { expect, test } from 'bun:test';
import { buildSceneColors } from './build-scene-colors';

test('it moves a scene colour with the palette token it refers to', () => {
  const before = buildSceneColors({
    semanticTokens: { scene: { respiteBlock: { value: '{colors.ink.400}' } } },
    tokens: { ink: { 400: { value: '#8fa0c2' } } },
  });

  const after = buildSceneColors({
    semanticTokens: { scene: { respiteBlock: { value: '{colors.ink.400}' } } },
    tokens: { ink: { 400: { value: '#2a3b4c' } } },
  });

  expect(before).toStrictEqual({ respiteBlock: '#8fa0c2' });
  expect(after).toStrictEqual({ respiteBlock: '#2a3b4c' });
});

test('it keeps a scene colour written as hex', () => {
  expect(
    buildSceneColors({
      semanticTokens: { scene: { ground: { value: '#3d424d' } } },
      tokens: {},
    }),
  ).toStrictEqual({ ground: '#3d424d' });
});

test('it lowercases a hex scene colour', () => {
  expect(
    buildSceneColors({
      semanticTokens: { scene: { ground: { value: '#3D424D' } } },
      tokens: {},
    }),
  ).toStrictEqual({ ground: '#3d424d' });
});

test('it follows a chain of semantic tokens down to a palette token', () => {
  expect(
    buildSceneColors({
      semanticTokens: {
        accent: { barrier: { value: '{colors.sky.300}' } },
        scene: { nodeSelected: { value: '{colors.accent.barrier}' } },
      },
      tokens: { sky: { 300: { value: '#7dd3fc' } } },
    }),
  ).toStrictEqual({ nodeSelected: '#7dd3fc' });
});

test('it resolves a reference to a token group through its DEFAULT token', () => {
  expect(
    buildSceneColors({
      semanticTokens: {
        edge: { DEFAULT: { value: '#64748b' }, strong: { value: '#475569' } },
        scene: { worldmapEdge: { value: '{colors.edge}' } },
      },
      tokens: {},
    }),
  ).toStrictEqual({ worldmapEdge: '#64748b' });
});

test('it rejects a preset with no scene colour group', () => {
  expect(() =>
    buildSceneColors({
      semanticTokens: { accent: { barrier: { value: '#7dd3fc' } } },
      tokens: {},
    }),
  ).toThrowWithMessage(Error, 'the preset has no scene colour token group');
});

test('it rejects a reference to a token the preset lacks', () => {
  expect(() =>
    buildSceneColors({
      semanticTokens: { scene: { nodeBase: { value: '{colors.slate.300}' } } },
      tokens: {},
    }),
  ).toThrowWithMessage(Error, 'the colour token colors.slate.300 does not exist in the preset');
});

test('it rejects a scene colour that is not a #rrggbb hex', () => {
  expect(() =>
    buildSceneColors({
      semanticTokens: { scene: { fogShroud: { value: '{colors.border.subtle}' } } },
      tokens: { border: { subtle: { value: 'rgba(94, 234, 212, 0.07)' } } },
    }),
  ).toThrowWithMessage(
    Error,
    'the colour token colors.border.subtle is rgba(94, 234, 212, 0.07), not a #rrggbb hex colour',
  );
});

test('it rejects a scene colour whose references loop back on themselves', () => {
  expect(() =>
    buildSceneColors({
      semanticTokens: {
        loop: {
          first: { value: '{colors.loop.second}' },
          second: { value: '{colors.loop.first}' },
        },
        scene: { ground: { value: '{colors.loop.first}' } },
      },
      tokens: {},
    }),
  ).toThrowWithMessage(
    Error,
    'the colour token colors.loop.first refers to itself through colors.scene.ground -> colors.loop.first -> colors.loop.second',
  );
});
