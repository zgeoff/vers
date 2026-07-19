/**
 * Standard isometric camera rotation about Y.
 */
export const CAMERA_ROTATION_Y = Math.atan(1 / Math.sqrt(2));
export const CAMERA_ROTATION_X = -Math.PI / 4;
export const CAMERA_DISTANCE = 40;

/**
 * Camera X/Z offset from the origin, precomputed from the fixed distance and isometric angle.
 */
export const ISOMETRIC_OFFSET_X = CAMERA_DISTANCE * Math.sin(CAMERA_ROTATION_Y);
export const ISOMETRIC_OFFSET_Z = CAMERA_DISTANCE * Math.cos(CAMERA_ROTATION_Y);

/**
 * Positions are scaled up so inter-node distances aren't sub-1, which looked wrong.
 */
export const NODE_POSITION_SCALING_FACTOR = 10;
