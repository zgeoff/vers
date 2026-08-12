import { sceneColors } from '@vers/design-system';
import type { RevealDistanceField, Viewport } from '@vers/worldmap-core';
import { buildRevealDistanceField, toHexPosition } from '@vers/worldmap-core';
import { useEffect, useMemo } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  LinearFilter,
  RedFormat,
  UnsignedByteType,
} from 'three';
import { texture } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { NODE_POSITION_SCALING_FACTOR } from '../consts';
import { useRevealSources } from '../state/use-reveal-sources';
import { useViewport } from '../state/use-viewport';

const SHROUD_COLOR = sceneColors.fogShroud;

/**
 * Scene-space distance (in unit-hex units) over which fog eases from clear to fully opaque past a
 * reveal disc's edge. Wider reads gentler.
 */
const FOG_FALLOFF = 3;

/**
 * Density texels per axial cell unit. Higher resolves rounder gradient contours at the cost of a
 * proportionally larger texture rebuild per viewport change.
 */
const FOG_TEXELS_PER_CELL = 4;

/**
 * Cells the fog quad extends past the tracked viewport, covering the screen edge between a fast
 * pan and the next viewport write.
 */
const FOG_VIEWPORT_MARGIN_CELLS = 2;

/**
 * The fog plane floats just above the node plane so dense fog hides the nodes and edges underneath
 * it.
 */
const FOG_ELEVATION = 0.2;

/**
 * Draws soft fog of war over the world map: one viewport-covering plane whose per-fragment opacity
 * samples a fog-density texture — the smootherstep-eased euclidean distance to the nearest reveal
 * disc, 0 over revealed ground and 1 a falloff past the frontier. Purely presentational: it
 * projects the density field from the store's reveal sources on every viewport change and stores
 * nothing itself. It renders nothing until both a viewport and reveal sources exist.
 */
export function FogOfWar() {
  const revealSources = useRevealSources();
  const viewport = useViewport();

  const fog = useMemo(() => {
    if (revealSources === null || viewport === null) {
      return null;
    }

    const inflated: Viewport = {
      maxCX: viewport.maxCX + FOG_VIEWPORT_MARGIN_CELLS,
      maxCY: viewport.maxCY + FOG_VIEWPORT_MARGIN_CELLS,
      minCX: viewport.minCX - FOG_VIEWPORT_MARGIN_CELLS,
      minCY: viewport.minCY - FOG_VIEWPORT_MARGIN_CELLS,
    };

    return {
      field: buildRevealDistanceField(revealSources, inflated, {
        falloff: FOG_FALLOFF,
        resolution: FOG_TEXELS_PER_CELL,
      }),
      fieldViewport: inflated,
    };
  }, [revealSources, viewport]);

  if (fog === null) {
    return null;
  }

  return <FogPlane field={fog.field} viewport={fog.fieldViewport} />;
}

interface FogPlaneProps {
  readonly field: RevealDistanceField;
  readonly viewport: Viewport;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- RevealDistanceField carries a Float32Array, which has no readonly form
function FogPlane(props: Readonly<FogPlaneProps>) {
  const plane = useMemo(() => {
    const bytes = new Uint8Array(props.field.values.length);

    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = Math.round((props.field.values[index] ?? 0) * 255);
    }

    const map = new DataTexture(
      bytes,
      props.field.cols,
      props.field.rows,
      RedFormat,
      UnsignedByteType,
    );

    // bilinear sampling between texel centers is what turns the texel grid into a continuous
    // gradient
    map.magFilter = LinearFilter;
    map.minFilter = LinearFilter;
    map.needsUpdate = true;

    const material = new MeshBasicNodeMaterial({
      color: SHROUD_COLOR,
      depthWrite: false,
      transparent: true,
    });

    material.opacityNode = texture(map).r;

    return { geometry: buildFogPlaneGeometry(props.viewport), map, material };
  }, [props.field, props.viewport]);

  useEffect(
    () => () => {
      plane.geometry.dispose();
      plane.material.dispose();
      plane.map.dispose();
    },
    [plane],
  );

  return <mesh geometry={plane.geometry} material={plane.material} />;
}

/**
 * One parallelogram quad covering the viewport's cell box in scene space. The axial-to-scene
 * mapping is linear, so the quad's uv interpolation lands each density texel's center exactly on
 * the axial coordinate it was sampled at; the half-cell margin matches the field's texel layout.
 */
function buildFogPlaneGeometry(viewport: Readonly<Viewport>): BufferGeometry {
  const corners = [
    toHexPosition(viewport.minCX - 0.5, viewport.minCY - 0.5),
    toHexPosition(viewport.maxCX + 0.5, viewport.minCY - 0.5),
    toHexPosition(viewport.minCX - 0.5, viewport.maxCY + 0.5),
    toHexPosition(viewport.maxCX + 0.5, viewport.maxCY + 0.5),
  ];

  const positions = new Float32Array(
    corners.flatMap(([x, y]) => [
      x * NODE_POSITION_SCALING_FACTOR,
      y * NODE_POSITION_SCALING_FACTOR,
      FOG_ELEVATION,
    ]),
  );

  const geometry = new BufferGeometry();

  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2));
  geometry.setIndex([0, 1, 2, 2, 1, 3]);

  return geometry;
}
