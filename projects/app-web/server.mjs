// The built server bundle (compiled from `src/server.ts`) already owns every request-handling
// concern — logging, security headers, rate limiting, static asset serving, and the SSR/RPC
// dispatch itself. This file only starts the Node process listening.
import { serve } from 'srvx';

const serverBuild = await import('./dist/server/server.js');

serve({
  fetch: (request) => serverBuild.default.fetch(request),
  port: process.env.PORT || 3000,
});
