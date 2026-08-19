/**
 * The atmosphere. Every layer is domain-warped noise thresholded into distinct shapes — wisps
 * with gaps between them, whose form changes as they move — never a uniform sheet whose alpha
 * wobbles. Banks drift between the far towers, mist rolls low across the gate end, the gate
 * slot's teal haze streams upward and pulses, vent plumes rise off rooftop machinery, and the
 * fog sea creeps in from a slowly turning wall encircling the plaza. No plane writes depth;
 * everything sits on the ink-exempt layer so fog never gets outlined.
 */
import { mx_noise_float, positionWorld, time, uv, vec2, vec3 } from 'three/tsl';
import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  DoubleSide,
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  type Scene,
} from 'three/webgpu';
import { atmoKnobs } from './knobs';
import { sceneAnimations } from './lifecycle';
import { DUSK_FOG, GATE_TEAL, SMOKE_BLUE } from './palette';

export const ATMO_LAYER = 1;

export interface SmokeAnchor {
  readonly height: number;
  readonly rise: number;
  readonly seed: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface AtmosphereOptions {
  readonly gate?: { readonly ry: number; readonly x: number; readonly z: number };
  readonly smokeAnchors?: ReadonlyArray<SmokeAnchor>;
}

export function addAtmosphere(scene: Scene, options: AtmosphereOptions = {}) {
  // fades every plane to nothing at its own edges so no rectangle outline ever shows
  const edgeFade = uv().x.mul(uv().x.oneMinus()).mul(uv().y).mul(uv().y.oneMinus()).mul(16);

  const banks = [
    { seed: 3, y: 6.25, z: -25 },
    { seed: 7, y: 8.75, z: -45 },
    { seed: 11, y: 12.5, z: -65 },
  ];

  for (const bank of banks) {
    const material = new MeshBasicNodeMaterial({
      color: new Color(DUSK_FOG),
      depthWrite: false,
      side: DoubleSide,
      transparent: true,
    });
    const coord = vec3(
      positionWorld.x.mul(0.048).add(time.mul(atmoKnobs.drift.mul(3))),
      positionWorld.y.mul(0.112),
      bank.seed,
    );
    // the warp curls the wisps; the fine octave scuds past faster than the body
    const warp = mx_noise_float(coord.mul(0.5).add(time.mul(atmoKnobs.drift))).mul(1.2);
    const detail = mx_noise_float(coord.mul(2.3).sub(time.mul(atmoKnobs.drift.mul(5)))).mul(0.5);
    const body = mx_noise_float(coord.add(warp)).add(detail).add(0.75).mul(0.5).smoothstep(0.45, 0.95);

    material.opacityNode = body.mul(edgeFade).mul(atmoKnobs.bankOpacity);

    const plane = new Mesh(new PlaneGeometry(225, 27.5), material);

    plane.layers.set(ATMO_LAYER);
    plane.position.set(0, bank.y, bank.z);
    scene.add(plane);
  }

  // two stacked mist layers rolling at different speeds across the gate end of the plaza
  for (const layer of [
    { scale: 0.064, seed: 17, speed: 1, y: 1.75 },
    { scale: 0.044, seed: 29, speed: 0.55, y: 3.75 },
  ]) {
    const material = new MeshBasicNodeMaterial({
      color: new Color(DUSK_FOG),
      depthWrite: false,
      side: DoubleSide,
      transparent: true,
    });
    const coord = vec3(
      positionWorld.x.mul(layer.scale).add(time.mul(atmoKnobs.drift.mul(layer.speed * 2))),
      positionWorld.z.mul(layer.scale).sub(time.mul(atmoKnobs.drift.mul(layer.speed))),
      layer.seed,
    );
    const warp = mx_noise_float(coord.mul(0.45).add(time.mul(atmoKnobs.drift.mul(0.7)))).mul(1.3);
    const body = mx_noise_float(coord.add(warp)).add(1).mul(0.5).smoothstep(0.42, 0.9);

    material.opacityNode = body.mul(edgeFade).mul(atmoKnobs.mistOpacity);

    const mist = new Mesh(new PlaneGeometry(140, 85), material);

    mist.layers.set(ATMO_LAYER);
    mist.rotation.x = -Math.PI / 2;
    mist.position.set(2.5, layer.y, -22.5);
    scene.add(mist);
  }

  // teal haze streaming up the gate slot, pulsing slowly — the way out is alive
  if (options.gate) {
    const gate = options.gate;
    const hazeMaterial = new MeshBasicNodeMaterial({
      blending: AdditiveBlending,
      color: new Color(GATE_TEAL),
      depthWrite: false,
      side: DoubleSide,
      transparent: true,
    });
    const coord = vec3(positionWorld.x.mul(0.28), positionWorld.y.mul(0.18).sub(time.mul(0.25)), 23);
    const warp = mx_noise_float(coord.mul(0.6)).mul(0.8);
    const body = mx_noise_float(coord.add(warp)).add(1).mul(0.5).smoothstep(0.25, 0.9);
    const pulse = time.mul(0.6).sin().mul(0.15).add(0.9);

    hazeMaterial.opacityNode = body.mul(edgeFade).mul(atmoKnobs.hazeOpacity).mul(pulse);

    const haze = new Mesh(new PlaneGeometry(10.5, 18), hazeMaterial);

    haze.layers.set(ATMO_LAYER);

    const cos = Math.cos(gate.ry);
    const sin = Math.sin(gate.ry);
    const localZ = -3;

    haze.position.set(localZ * sin + gate.x, 9.13, localZ * cos + gate.z);
    haze.rotation.y = gate.ry;
    scene.add(haze);
  }

  // the fog sea: ground fog surrounding the plaza, creeping inward as thresholded wisps.
  // Radial distance from the plaza center gates the opacity so the square itself stays clear.
  const plazaCenter = vec2(-2.5, -12.5);
  const radial = positionWorld.xz.sub(plazaCenter).length();
  const creep = radial.smoothstep(atmoKnobs.fogRadius, atmoKnobs.fogRadius.add(35));

  for (const layer of [
    { scale: 0.04, seed: 41, speed: 0.8, y: 2 },
    { scale: 0.028, seed: 47, speed: 0.5, y: 5 },
  ]) {
    const material = new MeshBasicNodeMaterial({
      color: new Color(DUSK_FOG),
      depthWrite: false,
      side: DoubleSide,
      transparent: true,
    });
    const coord = vec3(
      positionWorld.x.mul(layer.scale).add(time.mul(atmoKnobs.drift.mul(layer.speed))),
      positionWorld.z.mul(layer.scale).sub(time.mul(atmoKnobs.drift.mul(layer.speed * 0.7))),
      layer.seed,
    );
    const warp = mx_noise_float(coord.mul(0.5).add(time.mul(atmoKnobs.drift.mul(0.4)))).mul(1.2);
    const body = mx_noise_float(coord.add(warp)).add(1).mul(0.5).smoothstep(0.3, 0.75);

    // near-opaque in its heart, wispy at the creeping inner edge
    material.opacityNode = creep.mul(body.mul(0.7).add(0.3)).mul(atmoKnobs.fogSea);

    const sea = new Mesh(new PlaneGeometry(800, 800), material);

    sea.layers.set(ATMO_LAYER);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(-2.5, layer.y, -12.5);
    scene.add(sea);
  }

  // the fog wall: a slowly turning cylinder of wisps encircling the plaza, dense low, gone high
  const wallMaterial = new MeshBasicNodeMaterial({
    color: new Color(DUSK_FOG),
    depthWrite: false,
    side: DoubleSide,
    transparent: true,
  });
  const wallCoord = vec3(
    positionWorld.x.mul(0.032).add(time.mul(atmoKnobs.drift.mul(0.6))),
    positionWorld.y.mul(0.064),
    positionWorld.z.mul(0.032),
  );
  const wallWarp = mx_noise_float(wallCoord.mul(0.5).add(time.mul(atmoKnobs.drift.mul(0.3)))).mul(1.3);
  const wallBody = mx_noise_float(wallCoord.add(wallWarp)).add(1).mul(0.5).smoothstep(0.28, 0.8);
  const wallFade = positionWorld.y.smoothstep(7.5, 32.5).oneMinus();

  wallMaterial.opacityNode = wallBody.mul(0.75).add(0.25).mul(wallFade).mul(atmoKnobs.fogWall);

  const wall = new Mesh(new CylinderGeometry(67.5, 67.5, 35, 64, 1, true), wallMaterial);

  wall.layers.set(ATMO_LAYER);
  wall.position.set(-2.5, 17.5, -12.5);
  scene.add(wall);
  sceneAnimations.push((elapsed) => {
    wall.rotation.y = elapsed * 0.004;
  });

  // vent plumes: ragged smoke columns rising off the rooftop machinery
  for (const source of options.smokeAnchors ?? []) {
    const material = new MeshBasicNodeMaterial({
      color: new Color(SMOKE_BLUE),
      depthWrite: false,
      side: DoubleSide,
      transparent: true,
    });
    const coord = vec3(
      positionWorld.x.mul(0.36).add(source.seed),
      positionWorld.y.mul(0.22).sub(time.mul(source.rise)),
      source.seed,
    );
    const warp = mx_noise_float(coord.mul(0.6).add(time.mul(0.06))).mul(1.1);
    const body = mx_noise_float(coord.add(warp)).add(1).mul(0.5).smoothstep(0.3, 0.88);
    // solid at the vent mouth, ragged and gone by the top
    const taper = uv()
      .x.mul(uv().x.oneMinus())
      .mul(4)
      .mul(uv().y.smoothstep(0, 0.12))
      .mul(uv().y.oneMinus().pow(1.4));

    material.opacityNode = body.mul(taper).mul(atmoKnobs.smokeOpacity);

    const plume = new Mesh(new PlaneGeometry(source.width, source.height), material);

    plume.layers.set(ATMO_LAYER);
    plume.position.set(source.x, source.y + source.height / 2, source.z);
    scene.add(plume);
  }
}
