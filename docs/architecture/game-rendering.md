# Game rendering

The game world renders through one persistent three.js canvas; everything else — panels, tooltips,
stash, market, character sheets — is HTML built from the design system. 3D is reserved for what is
genuinely spatial; list-and-filter UI, forms, and text stay in the DOM lane where the design system,
accessibility, and testing already work.

## The persistent canvas

A single R3F `<Canvas>` mounts once in the authed game layout, as a sibling of the route outlet,
fixed at full viewport behind the route content. Layout routes do not remount across child
navigations, so the canvas — and its WebGL/WebGPU context, uploaded geometry, and compiled shaders —
survives every route change. The canvas loads behind a lazy client-only boundary: three.js never
lands in the initial bundle, and the streamed HTML shell paints before the world fades in.

The canvas is the sole owner of world assets. GPU contexts share nothing, so a second canvas pointed
at the world would re-upload and recompile all of it; anything that shows the world renders through
this one context. Self-contained 3D widgets with their own small asset sets — an avatar viewer, an
item inspector — get satellite canvases through a layout-level registry, which owns each satellite's
lifecycle policy (die with the route, or survive it).

## Scene and presentation

Route-driven world state has two independent axes:

- **Scene** — which world is on the canvas: `worldmap` (the explore graph) or `respite` (the home
  city). Sticky: only scene routes set it, and it persists untouched while non-scene routes are
  active.
- **Presentation** — how the current scene shows: `focus` (the canvas is the page, DOM renders HUD
  over it), `ambient` (the world recedes — dimmed, pulled back — behind an HTML panel), or `hidden`
  (frameloop suspended, zero GPU cost). Sticky like scene: a branch that declares no presentation
  keeps the current one, so every route's behavior is explicit in its own `staticData`.

Routes declare their contribution in `staticData`, merged along the matched branch so child routes
inherit what they don't override. Sub-routes contribute deltas within a scene, not new scenes:
`/explore/node/$id` keeps `worldmap` and adds a focus target the camera flies to, which makes world
positions deep-linkable and lets back/forward drive the camera. A scene-key change is a scene swap;
a delta within the same scene is a camera move. Ephemeral state — hover, in-flight animation — stays
in stores and never enters the URL.

| Route                 | Scene                     | Presentation |
| --------------------- | ------------------------- | ------------ |
| `/respite`            | `respite`                 | `focus`      |
| `/explore`            | `worldmap`                | `focus`      |
| `/explore/node/$id`   | `worldmap` + focus target | `focus`      |
| `/encounter`          | — (sticky)                | `ambient`    |
| `/stash`              | —                         | `ambient`    |
| `/market`             | —                         | `ambient`    |
| `/market/listing/$id` | —                         | inherits     |
| `/avatar`             | —                         | `ambient`    |

Ambient presentation over a sticky scene is what makes the app feel like one continuous space:
opening the stash from the map recedes the map; opening it from home recedes the city.

## Transitions

Route transitions use the View Transitions API through the router's `viewTransition` support, with
transition types derived from the scene/presentation change (scene swap, focus→ambient, intra-scene
delta). `staticData` is not readable inside the router's `types` callback, so one shared resolver
maps a location to its scene state and feeds both the store and the transition types. The canvas
container carries a stable `view-transition-name`, so the live world keeps rendering through a
transition instead of being frozen into the page snapshot. Browsers without the API fall back to
instant navigation; camera choreography within a scene is the scene's own concern and needs no
router involvement.

## Renderer

The renderer is `WebGPURenderer`, constructed through R3F's async `gl` prop, with its automatic
WebGL2 fallback covering browsers without WebGPU. That constrains authoring:

- **Shaders are TSL only.** TSL compiles to WGSL or GLSL, so one codebase serves both backends.
  `ShaderMaterial`, `RawShaderMaterial`, and `GLBufferAttribute` don't exist on the fallback and are
  banned.
- **Post-processing goes through the node-based `RenderPipeline`**, which runs on both backends.
  `EffectComposer` and pmndrs/postprocessing are WebGL-only dead ends.
- **World-map rendering is instanced.** `WebGPURenderer` is slower than WebGL for many
  individually-drawn meshes but faster for instanced, draw-call-heavy scenes; nodes and edges render
  via `InstancedMesh`/`BatchedMesh` with shared geometry, never one mesh per node.
- The WebGL fallback path is exercised in tests (`forceWebGL`), not assumed.

## R3F usage constraints

R3F is pinned to the v9 line, and three of its edges are walled off:

- **The game loop lives behind an internal scheduler wrapper**, not raw `useFrame` timing: R3F v9's
  clock cannot pause or provide deterministic time, and a wrapper keeps loop semantics ours.
- **Renderer access goes through one utility**, never `state.gl` scattered through scene code.
- **`createPortal` containers are stable for the life of their children** — swapping a portal's
  container strands the children under React 19.

drei and tunnel-rat are reference material, not dependencies: drei trails R3F majors and carries
GLSL-era helpers the fallback can't run, and tunnel-rat is unmaintained. Where a helper earns its
keep it is vendored or reimplemented; camera controls come from yomotsu/camera-controls directly.

## Scene ↔ DOM bridge

Scene and DOM communicate through zustand stores, in both directions, with two read disciplines: DOM
overlays subscribe reactively; the render loop reads imperatively via `getState()` inside the frame
callback, never through reactive selectors. HTML that must render from inside the scene tree crosses
over through a small in-house tunnel (paired in/out components over a store) or a plain portal.
