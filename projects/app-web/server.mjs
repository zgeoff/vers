// The built server bundle owns all request handling; this file only starts the Node process
// listening.
import { serve } from 'srvx';

const serverBuild = await import('./dist/server/server.js');

// srvx already reads `PORT` (defaulting to 3000) on its own — no need to thread it through here
serve({
  fetch: (request) => serverBuild.default.fetch(request),
});
