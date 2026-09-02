import type { DataTexture } from 'three';
import { mx_noise_float, positionWorld, texture, time } from 'three/tsl';
import type { Node } from 'three/webgpu';

// structural stand-in for three's TSL operator types: those carry thousands of conditional
// overloads and swizzle getters, and one call sends tsgo's inference into a multi-gigabyte runaway
// that OOMs the machine; the objects behind it stay real TSL nodes, so the runtime graph is intact
export interface TSLMathNode {
  readonly add: (other: TSLMathNode | number) => TSLMathNode;
  readonly clamp: (min: number, max: number) => TSLMathNode;
  readonly mul: (other: TSLMathNode | number) => TSLMathNode;
  readonly oneMinus: () => TSLMathNode;
  readonly sub: (other: TSLMathNode | number) => TSLMathNode;
}

export interface TSLTextureNode {
  readonly r: TSLMathNode;
  value: DataTexture;
}

interface SceneTSL {
  readonly mx_noise_float: (coord: TSLMathNode) => TSLMathNode;
  readonly positionWorld: { readonly xz: TSLMathNode };
  readonly texture: (map: DataTexture) => TSLTextureNode;
  readonly time: TSLMathNode;
  readonly toNode: (node: Readonly<TSLTextureNode> | TSLMathNode) => Node<'vec4'>;
}

const sceneTSLValues = {
  mx_noise_float,
  positionWorld,
  texture,
  time,
  toNode: (node: unknown) => node,
};

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the values are untouched runtime TSL builders; only the static view narrows
export const sceneTSL = sceneTSLValues as unknown as SceneTSL;
