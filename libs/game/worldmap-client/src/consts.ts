// standard isometric camera rotation
export const CAMERA_ROTATION_Y = Math.atan(1 / Math.sqrt(2));
export const CAMERA_ROTATION_X = -Math.PI / 4;

// fixed camera distance
export const CAMERA_DISTANCE = 40;

// precalculate our X/Z offset for the camera at our origin
export const ISOMETRIC_OFFSET_X = CAMERA_DISTANCE * Math.sin(CAMERA_ROTATION_Y);
export const ISOMETRIC_OFFSET_Z = CAMERA_DISTANCE * Math.cos(CAMERA_ROTATION_Y);

// we scale up our positions because it feels weird to be woring with
// distances of <1 between nodes
export const NODE_POSITION_SCALING_FACTOR = 10;
