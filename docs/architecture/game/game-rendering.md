# Game rendering

The game world renders through one persistent three.js canvas. Every other UI element — panels,
tooltips, stash, market, character sheets — is HTML from the design system. 3D is reserved for
genuinely spatial content. List-and-filter UI, forms, and text stay in the DOM lane, where the
design system, accessibility, and testing already work.

## The persistent canvas

A single R3F `<Canvas>` mounts once in the authed game layout, as a sibling of the route outlet,
fixed at full viewport behind the route content. Layout routes do not remount across child
navigations, so the canvas survives every route change — along with its WebGL/WebGPU context,
uploaded geometry, and compiled shaders. The canvas loads behind a lazy client-only boundary, so
three.js never lands in the initial bundle. The streamed HTML shell paints before the world fades
in.

The canvas is the sole owner of world assets. GPU contexts share nothing, so a second canvas pointed
at the world would re-upload and recompile all of it. Anything that shows the world renders through
this one context. A self-contained 3D widget with its own small asset set — an avatar viewer, an
item inspector — gets a satellite canvas through a layout-level registry. The registry owns each
satellite's lifecycle policy: it dies with its route or survives it (`keepAlive`).

## Scene and presentation

Route-driven world state has two independent axes, scene and presentation, both sticky. Each route
declares its contribution to either axis in `staticData`, and `resolveSceneState` folds those
contributions along the matched branch so a child inherits what it doesn't override. An axis a
branch never declares keeps its previous value.

- **Scene** — which world is on the canvas: the `worldmap` explore graph or the `respite` home city.
  Only scene routes set it, so it persists untouched while non-scene routes are active.
- **Presentation** — how the current scene shows. Three modes:
  - `focus` — the canvas is the page, and DOM renders a HUD over it.
  - `ambient` — the world recedes behind an HTML panel, dimmed and pulled back.
  - `hidden` — the frameloop suspends, so the canvas pays zero GPU cost off-screen.

A scene route declares a scene key plus `focus`. An overlay route declares `ambient` and leaves the
scene sticky, so the world recedes behind it. A route declaring neither inherits both from its
branch. Ambient presentation over a sticky scene makes the app feel like one continuous space:
opening the stash from the map recedes the map, and opening it from home recedes the city.

Sub-routes contribute deltas within a scene, not new scenes. `/explore/node/$nodeID` keeps
`worldmap` and adds a focus target the camera flies to. The path param makes world positions
deep-linkable and lets back/forward drive the camera. A scene-key change is a scene swap; a delta
within the same scene is a camera move. Ephemeral state — hover, in-flight animation — stays in
stores and never enters the URL.

## Transitions

Route transitions run through the router's View Transitions API support, with transition types
derived from the scene/presentation change: `scene-swap` when the scene key changes, a
`to-<presentation>` name when presentation changes, and `same-scene` when neither does. `staticData`
is not readable inside the router's `types` callback, so that path runs `matchRoutes` itself and
folds the matched branch through the same `resolveSceneState` that syncs the store. The canvas
container carries a stable `view-transition-name`, so the live world keeps rendering through a
transition instead of freezing into the page snapshot. Browsers without the API fall back to instant
navigation. Camera choreography within a scene is the scene's own concern and needs no router
involvement.

## Renderer

The renderer is `WebGPURenderer`, constructed through R3F's async `gl` prop. Its automatic WebGL2
fallback covers browsers without WebGPU. That fallback constrains authoring:

- **Shaders are TSL only.** TSL compiles to WGSL or GLSL, so one codebase serves both backends.
  `ShaderMaterial`, `RawShaderMaterial`, and `GLBufferAttribute` don't exist on the fallback and are
  banned.
- **Post-processing goes through the node-based `RenderPipeline`**, which runs on both backends.
  `EffectComposer` and pmndrs/postprocessing are WebGL-only dead ends.
- **World-map rendering is instanced.** `WebGPURenderer` is slower than WebGL for many
  individually-drawn meshes but faster for instanced, draw-call-heavy scenes. Nodes and edges render
  via `InstancedMesh`/`BatchedMesh` with shared geometry, never one mesh per node.
- **The `forceWebGL` prop forces the WebGL2 backend**, so the fallback path can be driven directly
  rather than trusting WebGPU's automatic fallback.

## R3F usage constraints

R3F is pinned to the v9 line, and three of its edges are walled off:

- **The game loop lives behind an internal scheduler wrapper**, not raw `useFrame` timing. R3F v9's
  clock cannot pause or provide deterministic time, and the wrapper keeps loop semantics ours.
- **Renderer access goes through one utility** (`useRenderer`), never `state.gl` scattered through
  scene code.
- **`createPortal` containers stay stable for the life of their children.** Swapping a portal's
  container strands the children under React 19.

drei and tunnel-rat are reference material, not dependencies. drei trails R3F majors and carries
GLSL-era helpers the fallback can't run, and tunnel-rat is unmaintained. The project vendors or
reimplements a helper worth keeping. Camera controls come from `yomotsu/camera-controls` directly.

## Scene ↔ DOM bridge

Scene and DOM communicate through zustand stores in both directions, under two read disciplines. DOM
overlays subscribe reactively. The render loop reads imperatively via `getState()` inside the frame
callback, never through reactive selectors.

HTML that must render from inside the scene tree crosses back to the DOM through a small in-house
tunnel or a plain portal. The tunnel pairs in/out components over a store (`sceneTunnel`).
