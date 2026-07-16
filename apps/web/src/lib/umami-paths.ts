/**
 * Same-origin paths the Umami tracker rides. The root route's script tag loads `script`, and the
 * tracker appends Umami's own `/api/send` to `hostURL` for its beacons, yielding `send` — both
 * answered by the server's analytics proxy. First-party paths with neutral names keep the tracker
 * off ad-blocker lists that match Umami's default script name and third-party analytics origins.
 */
export const UMAMI_PATHS = {
  hostURL: '/site',
  script: '/site.js',
  send: '/site/api/send',
} as const;
