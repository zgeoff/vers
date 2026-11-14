// The run endpoints that answer /health, which the doctor's stack check reads in this order.
export const stackHealthEndpoints = [
  'keys',
  'user',
  'session',
  'verification',
  'email',
  'avatar',
  'replay',
  'activity',
  'web',
] as const;
