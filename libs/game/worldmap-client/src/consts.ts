/**
 * Standard isometric camera rotation about Y.
 */
export const CAMERA_ROTATION_Y = Math.atan(1 / Math.sqrt(2));
export const CAMERA_ROTATION_X = -Math.PI / 4;

/**
 * Graph node coordinates are multiplied into scene units so adjacent nodes sit more than one unit
 * apart.
 */
export const NODE_POSITION_SCALING_FACTOR = 10;

/**
 * Closest the free camera may dolly in. Playtest-tunable on feel.
 */
export const ZOOM_MIN_DISTANCE = 25;

/**
 * Farthest the free camera may dolly out. Playtest-tunable on feel, within the bound that every
 * viewport it produces still fits the reveal query's single-request cell cap.
 */
export const ZOOM_MAX_DISTANCE = 120;
