/**
 * Respite viewer — the asset-facing look-dev tool. Three views over one shared rig: the gym
 * (one asset at real scale beside a reference figure), the stage (the composed scene, built
 * only from placement data and authored GLBs), and the plan (drag the layout, save it to
 * disk). Blender re-exports land in the watched model directory and hot-swap into whichever
 * view is live.
 */
import { AgXToneMapping, Color, NoToneMapping } from 'three/webgpu';
import {
  OrthographicCamera,
  PerspectiveCamera,
  Plane,
  type PostProcessing,
  Raycaster,
  Vector2,
  Vector3,
  WebGPURenderer,
} from 'three/webgpu';
import { loadKnobValues, loadPlacements, saveKnobValues, savePlacements } from './data';
import { buildGymScene, type GymLighting } from './gym';
import { applyHoverGlow, getHoveredKey, hoverPickBoxes } from './hover';
import { pixelRatio } from './knobs';
import { disposeBuiltScene, getBuilt, sceneAnimations } from './lifecycle';
import { getModel, listModels, startModelWatch, subscribeModels } from './models';
import { buildPlanScene, findOverlaps, type PlanGroup, PLAN_SELECTED_COLOR } from './plan';
import { buildPost } from './post';
import { buildStageScene } from './stage';
import {
  applyKnobValues,
  applyTunerKnobs,
  buildTunerConfig,
  registerKnob,
  renderTunerPanel,
  subscribeTunerChange,
} from './tuner';
import type { PlacementsFile } from './types';

/** The composition's baked framing — the distance the town is meant to be read from. */
const STAGE_CAMERA = {
  position: { x: 89.55, y: 74.43, z: 102.78 },
  target: { x: 0, y: 10, z: -17.5 },
};

type ViewKey = 'gym' | 'plan' | 'stage';

async function main() {
  // bun's dev-server HMR can re-execute the module; a second renderer + loop fights the first
  const globalState = globalThis as { __viewerBooted?: boolean };

  if (globalState.__viewerBooted) {
    return;
  }

  globalState.__viewerBooted = true;

  const placements: PlacementsFile = await loadPlacements();

  const renderer = new WebGPURenderer({ antialias: true });
  const displayPixelRatio = Math.min(2, globalThis.devicePixelRatio);

  renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
  renderer.setPixelRatio(displayPixelRatio);
  document.body.appendChild(renderer.domElement);
  await renderer.init();

  // Supersampling, and the only anti-aliasing the ink outlines respond to: they are drawn per
  // output pixel in the post chain, after the multisample resolve, so raising this renders them
  // larger and shrinks them down rather than filtering them after the fact. Cost rises with the
  // square of the value.
  registerKnob(
    'render.pixelRatio',
    displayPixelRatio,
    0.5,
    3,
    (value) => {
      renderer.setPixelRatio(value);
      pixelRatio.value = value;
      updatePixelReadout();
    },
    0.05,
  );

  // the knob's real units are pixels, so report the buffer it produces; the next view select or
  // pointer move restores the normal status line
  function updatePixelReadout() {
    const readout = document.getElementById('info');

    if (!readout) {
      return;
    }

    const size = renderer.getDrawingBufferSize(new Vector2());

    readout.textContent = `pixel ratio ${renderer.getPixelRatio().toFixed(2)} · buffer ${Math.round(size.x)} × ${Math.round(size.y)}`;
    readout.style.display = 'block';
  }

  const camera = new PerspectiveCamera(36, globalThis.innerWidth / globalThis.innerHeight, 0.25, 750);

  // the main camera sees the atmosphere layer; the ink edge camera never enables it
  camera.layers.enable(1);

  const planCamera = new OrthographicCamera(-1, 1, 1, -1, 0.25, 500);

  // the plan's own framing: half-height in metres, plus the point it centers on
  let planHalfHeight = 75;
  const planCenter = new Vector2(-15, -30);

  const updatePlanCamera = () => {
    const aspect = globalThis.innerWidth / globalThis.innerHeight;

    planCamera.left = -planHalfHeight * aspect;
    planCamera.right = planHalfHeight * aspect;
    planCamera.top = planHalfHeight;
    planCamera.bottom = -planHalfHeight;
    planCamera.position.set(planCenter.x, 200, planCenter.y);
    planCamera.up.set(0, 0, -1);
    planCamera.lookAt(planCenter.x, 0, planCenter.y);
    planCamera.updateProjectionMatrix();
  };

  updatePlanCamera();

  // ---- orbit state ----
  const orbitTarget = new Vector3(0, 10, -17.5);
  let orbitActive = false;
  let orbitDragging = false;
  let orbitPanning = false;
  let orbitRadius = 83.75;
  let orbitTheta = 0;
  let orbitPhi = 1.42;
  let lastPointerX = 0;
  let lastPointerY = 0;

  const applyOrbit = () => {
    const sinPhi = Math.sin(orbitPhi);

    camera.position.set(
      orbitTarget.x + orbitRadius * sinPhi * Math.sin(orbitTheta),
      orbitTarget.y + orbitRadius * Math.cos(orbitPhi),
      orbitTarget.z + orbitRadius * sinPhi * Math.cos(orbitTheta),
    );
    camera.lookAt(orbitTarget);
  };

  // ---- plan editor state ----
  let planGroups: Array<PlanGroup> = [];
  let selected: PlanGroup | null = null;
  let dragging = false;
  let planPanning = false;

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
  const dragPoint = new Vector3();
  const grabOffset = new Vector2();

  // ---- view state ----
  let activeView: ViewKey = 'stage';
  let gymModel: string | null = null;
  let gymLighting: GymLighting = 'night';

  const info = document.getElementById('info');
  const hud = document.getElementById('hud');
  const tuner = document.getElementById('tuner');
  const assets = document.getElementById('assets');

  const updateInfo = (flash?: string) => {
    if (!info) {
      return;
    }

    if (activeView === 'plan') {
      const overlaps = findOverlaps(placements);
      const report = overlaps.length === 0 ? 'none' : overlaps.join(', ');

      (globalThis as { __viewerOverlaps?: Array<string> }).__viewerOverlaps = overlaps;
      info.textContent = `${flash ?? (selected ? `selected: ${selected.label}` : 'click an element')} · drag to move · shift-drag to pan · wheel to zoom · Q/E rotate · S save layout · overlaps: ${report}`;
    } else if (activeView === 'gym') {
      info.textContent = flash ?? `${gymModel ?? 'no model'} · ${gymLighting} · drag to orbit · L toggle light`;
    } else {
      info.textContent = flash ?? 'drag to orbit · shift-drag to pan · C copy camera';
    }

    info.style.display = 'block';
  };

  const selectStageCamera = () => {
    orbitTarget.set(STAGE_CAMERA.target.x, STAGE_CAMERA.target.y, STAGE_CAMERA.target.z);
    camera.position.set(STAGE_CAMERA.position.x, STAGE_CAMERA.position.y, STAGE_CAMERA.position.z);
    camera.lookAt(orbitTarget);

    // seed the orbit state from the baked framing so a drag continues from where we look
    const offset = camera.position.clone().sub(orbitTarget);

    orbitRadius = offset.length();
    orbitTheta = Math.atan2(offset.x, offset.z);
    orbitPhi = Math.acos(Math.min(1, Math.max(-1, offset.y / orbitRadius)));
  };

  const buildActiveView = (): PostProcessing => {
    sceneAnimations.length = 0;
    applyHoverGlow(null, renderer.domElement);

    if (activeView === 'plan') {
      orbitActive = false;
      selected = null;
      renderer.toneMapping = NoToneMapping;
      updatePlanCamera();

      const plan = buildPlanScene(placements);

      planGroups = plan.groups;

      return buildPost(renderer, plan.scene, planCamera, { bloomStrength: 0, bloomThreshold: 1 });
    }

    if (activeView === 'gym') {
      orbitActive = true;
      renderer.toneMapping = AgXToneMapping;

      const frame = buildGymScene(gymModel, gymLighting);

      orbitTarget.set(0, frame.targetY, 0);
      orbitRadius = frame.radius;
      orbitTheta = 0.6;
      orbitPhi = 1.24;
      applyOrbit();

      return buildPost(renderer, frame.scene, camera, {
        bloomStrength: gymLighting === 'night' ? 0.46 : 0.12,
        bloomThreshold: gymLighting === 'night' ? 0.62 : 0.9,
        grade: true,
      });
    }

    orbitActive = true;
    renderer.toneMapping = AgXToneMapping;
    selectStageCamera();

    return buildPost(renderer, buildStageScene(placements), camera, { grade: true });
  };

  let postProcessing: PostProcessing;

  const selectView = () => {
    // tear down the outgoing build's GPU resources before the new one takes over
    const stale = getBuilt();

    postProcessing = buildActiveView();

    const current = getBuilt();

    if (stale.scene && stale.scene !== current.scene) {
      disposeBuiltScene(stale.scene);
    }

    if (stale.nodes !== current.nodes) {
      for (const node of stale.nodes) {
        node.dispose?.();
      }
    }

    // re-impose tuned values onto the freshly built scene's lights, materials, and bloom
    applyTunerKnobs();
    renderHUD();
    renderAssetList();
    updateInfo();

    if (tuner) {
      tuner.style.display = activeView === 'plan' ? 'none' : 'block';
    }
  };

  /**
   * What placing the gym's current asset would do, or null when it already sits in the town.
   * An asset whose name matches a waiting slot fills that slot in place, keeping the position
   * already composed for it; anything else joins the town as a new slot near the plaza.
   */
  interface PendingPlacement {
    readonly file: string;
    readonly kind: 'add' | 'fill';
    readonly slot: string;
  }

  const planPlacementFor = (file: string | null): PendingPlacement | null => {
    if (!file) {
      return null;
    }

    if (placements.models.some((slot) => slot.file === file)) {
      return null;
    }

    const key = file.replace(/\.glb$/, '').replace(/^respite-/, '');
    const waiting = placements.models.find((slot) => slot.key === key && slot.file === null);

    return { file, kind: waiting ? 'fill' : 'add', slot: waiting ? waiting.key : key };
  };

  const applyPlacement = (pending: PendingPlacement) => {
    const waiting = placements.models.find((slot) => slot.key === pending.slot && slot.file === null);

    if (waiting) {
      // the slot keeps its composed position, and its placeholder size stays on record so
      // dropping the asset again restores the box it stood in for
      placements.models[placements.models.indexOf(waiting)] = {
        file: pending.file,
        key: waiting.key,
        nav: waiting.nav,
        ry: waiting.ry,
        scale: 1,
        ...(waiting.size ? { size: waiting.size } : {}),
        x: waiting.x,
        z: waiting.z,
      };

      return;
    }

    placements.models.push({
      file: pending.file,
      key: pending.slot,
      nav: false,
      ry: 0,
      scale: 1,
      x: 0,
      z: 4,
    });
  };

  const renderHUD = () => {
    if (!hud) {
      return;
    }

    hud.innerHTML = '';

    for (const [key, label] of [
      ['stage', '1 · Stage'],
      ['gym', '2 · Gym'],
      ['plan', '3 · Plan'],
    ] as const) {
      const button = document.createElement('button');

      button.textContent = label;
      button.className = key === activeView ? 'active' : '';
      button.addEventListener('click', () => {
        activeView = key;
        selectView();
      });
      hud.appendChild(button);
    }

    if (activeView === 'gym') {
      const toggle = document.createElement('button');

      toggle.textContent = gymLighting === 'night' ? '☾ night' : '☀ neutral';
      toggle.addEventListener('click', () => {
        gymLighting = gymLighting === 'night' ? 'neutral' : 'night';
        selectView();
      });
      hud.appendChild(toggle);

      const placement = planPlacementFor(gymModel);

      if (placement) {
        const place = document.createElement('button');

        place.textContent = placement.kind === 'fill' ? `fill ${placement.slot} slot` : 'add to town';
        place.addEventListener('click', () => {
          applyPlacement(placement);
          void savePlacements(placements).then(() => {
            activeView = 'plan';
            selectView();
            updateInfo(`${gymModel ?? ''} placed as ${placement.slot}`);
          });
        });
        hud.appendChild(place);
      }
    }

    if (activeView === 'plan') {
      const save = document.createElement('button');

      save.textContent = 'save layout';
      save.addEventListener('click', () => {
        void savePlacements(placements).then(() => updateInfo('layout saved'));
      });
      hud.appendChild(save);
    }
  };

  const renderAssetList = () => {
    if (!assets) {
      return;
    }

    if (activeView !== 'gym') {
      assets.style.display = 'none';
      return;
    }

    assets.style.display = 'block';
    assets.innerHTML = '';

    const models = listModels();

    if (models.length === 0) {
      const empty = document.createElement('div');

      empty.className = 'asset-empty';
      empty.textContent = 'no .glb in the watched directory';
      assets.appendChild(empty);

      return;
    }

    for (const name of models) {
      const button = document.createElement('button');

      button.textContent = name.replace(/\.glb$/, '');
      button.className = name === gymModel ? 'active' : '';
      button.addEventListener('click', () => {
        gymModel = name;
        selectView();
      });
      assets.appendChild(button);
    }
  };

  // ---- persistence ----
  const saved = await loadKnobValues();

  applyKnobValues(saved);

  let knobSaveTimer: ReturnType<typeof setTimeout> | undefined;

  subscribeTunerChange(() => {
    clearTimeout(knobSaveTimer);
    knobSaveTimer = setTimeout(() => void saveKnobValues(buildTunerConfig()), 400);
  });

  if (tuner) {
    renderTunerPanel(tuner);
  }

  // ---- model watch ----
  subscribeModels((changed, added) => {
    // an added model with no gym selection becomes the subject; any change rebuilds the view
    gymModel ??= added[0] ?? null;

    if (gymModel && !listModels().includes(gymModel)) {
      gymModel = listModels()[0] ?? null;
    }

    if (changed.length > 0 || added.length > 0) {
      selectView();
    }
  });

  const params = new URLSearchParams(globalThis.location.search);
  const requested = params.get('v');

  if (requested === 'gym' || requested === 'plan' || requested === 'stage') {
    activeView = requested;
  }

  startModelWatch();
  selectView();

  // ---- input ----
  const toPointerNDC = (event: PointerEvent) => {
    pointer.set(
      (event.clientX / globalThis.innerWidth) * 2 - 1,
      -(event.clientY / globalThis.innerHeight) * 2 + 1,
    );
  };

  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (activeView !== 'plan') {
      orbitDragging = true;
      orbitPanning = event.shiftKey || event.button === 2;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;

      return;
    }

    // shift- or right-drag pans the plan instead of grabbing an element
    if (event.shiftKey || event.button === 2) {
      planPanning = true;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;

      return;
    }

    toPointerNDC(event);
    raycaster.setFromCamera(pointer, planCamera);

    const hits = raycaster.intersectObjects(
      planGroups.map((entry) => entry.group),
      true,
    );
    const hitGroup = hits
      .map((hit) => planGroups.find((entry) => entry.group === hit.object.parent))
      .find((entry) => entry !== undefined);

    for (const entry of planGroups) {
      entry.material.color.set(new Color(entry.baseColor));
    }

    selected = hitGroup ?? null;

    if (selected) {
      selected.material.color.set(new Color(PLAN_SELECTED_COLOR));

      if (raycaster.ray.intersectPlane(groundPlane, dragPoint)) {
        grabOffset.set(dragPoint.x - selected.target.x, dragPoint.z - selected.target.z);
        dragging = true;
      }
    }

    updateInfo();
  });

  renderer.domElement.addEventListener('pointermove', (event) => {
    if (activeView === 'stage') {
      toPointerNDC(event);
      raycaster.setFromCamera(pointer, camera);

      const hoverHits = raycaster.intersectObjects(hoverPickBoxes, false);
      const hoverHitKey = (hoverHits[0]?.object.userData['hoverKey'] as string | undefined) ?? null;

      if (hoverHitKey !== getHoveredKey()) {
        applyHoverGlow(hoverHitKey, renderer.domElement);
      }
    }

    if (orbitActive) {
      if (!orbitDragging) {
        return;
      }

      const dx = event.clientX - lastPointerX;
      const dy = event.clientY - lastPointerY;

      lastPointerX = event.clientX;
      lastPointerY = event.clientY;

      if (orbitPanning) {
        // pan the target along the camera's screen axes
        const scale = orbitRadius * 0.0012;
        const right = new Vector3().setFromMatrixColumn(camera.matrix, 0);
        const up = new Vector3().setFromMatrixColumn(camera.matrix, 1);

        orbitTarget.addScaledVector(right, -dx * scale);
        orbitTarget.addScaledVector(up, dy * scale);
      } else {
        orbitTheta -= dx * 0.005;
        orbitPhi = Math.min(1.52, Math.max(0.12, orbitPhi - dy * 0.005));
      }

      applyOrbit();

      return;
    }

    if (activeView === 'plan' && planPanning) {
      // one screen pixel is one world unit divided by the current zoom
      const perPixel = (planHalfHeight * 2) / globalThis.innerHeight;

      planCenter.x -= (event.clientX - lastPointerX) * perPixel;
      planCenter.y -= (event.clientY - lastPointerY) * perPixel;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      updatePlanCamera();

      return;
    }

    if (activeView !== 'plan' || !dragging || !selected) {
      return;
    }

    toPointerNDC(event);
    raycaster.setFromCamera(pointer, planCamera);

    if (raycaster.ray.intersectPlane(groundPlane, dragPoint)) {
      selected.target.x = Math.round((dragPoint.x - grabOffset.x) * 10) / 10;
      selected.target.z = Math.round((dragPoint.z - grabOffset.y) * 10) / 10;
      selected.group.position.set(selected.target.x, 0, selected.target.z);
    }
  });

  renderer.domElement.addEventListener('pointerup', () => {
    orbitDragging = false;

    if (activeView !== 'plan') {
      return;
    }

    dragging = false;
    planPanning = false;
    updateInfo();
  });

  renderer.domElement.addEventListener('wheel', (event) => {
    event.preventDefault();

    if (activeView === 'plan') {
      planHalfHeight = Math.min(350, Math.max(15, planHalfHeight * (1 + event.deltaY * 0.001)));
      updatePlanCamera();

      return;
    }

    if (orbitActive) {
      orbitRadius = Math.min(400, Math.max(5, orbitRadius * (1 + event.deltaY * 0.001)));
      applyOrbit();
    }
  });

  renderer.domElement.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });

  globalThis.addEventListener('keydown', (event) => {
    // typing in a tuner input must not switch views
    if (event.target instanceof HTMLInputElement) {
      return;
    }

    if (activeView === 'plan' && selected && (event.key === 'q' || event.key === 'e')) {
      selected.target.ry += event.key === 'q' ? 0.05 : -0.05;
      selected.group.rotation.y = selected.target.ry;
      updateInfo();

      return;
    }

    if (activeView === 'plan' && event.key === 's') {
      void savePlacements(placements).then(() => updateInfo('layout saved'));

      return;
    }

    if (activeView === 'gym' && event.key === 'l') {
      gymLighting = gymLighting === 'night' ? 'neutral' : 'night';
      selectView();

      return;
    }

    // C copies the live camera as JSON — orbit to a framing, dump it, bake it as the default
    if (event.key === 'c') {
      const cameraState = {
        fov: camera.fov,
        position: {
          x: Math.round(camera.position.x * 100) / 100,
          y: Math.round(camera.position.y * 100) / 100,
          z: Math.round(camera.position.z * 100) / 100,
        },
        target: {
          x: Math.round(orbitTarget.x * 100) / 100,
          y: Math.round(orbitTarget.y * 100) / 100,
          z: Math.round(orbitTarget.z * 100) / 100,
        },
      };
      const serialized = JSON.stringify(cameraState, null, 2);

      console.log(serialized);
      void navigator.clipboard.writeText(serialized).catch(() => {});
      updateInfo('camera copied to clipboard + console');

      return;
    }

    const views: Array<ViewKey> = ['stage', 'gym', 'plan'];
    const view = views[Number(event.key) - 1];

    if (view) {
      activeView = view;
      selectView();
    }
  });

  globalThis.addEventListener('resize', () => {
    camera.aspect = globalThis.innerWidth / globalThis.innerHeight;
    camera.updateProjectionMatrix();
    updatePlanCamera();
    renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
  });

  // ---- agent hooks ----
  (globalThis as { __viewerCheck?: () => Array<string> }).__viewerCheck = () => findOverlaps(placements);
  (globalThis as { __viewerPlacements?: PlacementsFile }).__viewerPlacements = placements;
  (globalThis as { __viewerModels?: () => Array<string> }).__viewerModels = listModels;
  (globalThis as { __viewerBounds?: (name: string) => unknown }).__viewerBounds = (name) => {
    const entry = getModel(name);

    return entry ? { max: entry.bounds.max.toArray(), min: entry.bounds.min.toArray() } : null;
  };
  (globalThis as { __viewerGPU?: () => unknown }).__viewerGPU = () => ({
    memory: { ...renderer.info.memory },
    render: { ...renderer.info.render },
  });
  (
    globalThis as {
      __viewerOrbit?: (tx: number, ty: number, tz: number, radius: number, theta: number, phi: number) => void;
    }
  ).__viewerOrbit = (tx, ty, tz, radius, theta, phi) => {
    orbitTarget.set(tx, ty, tz);
    orbitRadius = radius;
    orbitTheta = theta;
    orbitPhi = phi;
    applyOrbit();
  };

  renderer.setAnimationLoop(() => {
    const elapsed = performance.now() / 1000;

    for (const animation of sceneAnimations) {
      animation(elapsed);
    }

    postProcessing.render();
  });
}

void main();
