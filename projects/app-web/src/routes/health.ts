import { createFileRoute } from '@tanstack/react-router';

/** Liveness probe: no auth, no downstream calls, just confirms the server process is up. */
export const Route = createFileRoute('/health')({
  server: {
    handlers: {
      GET: () => Response.json({ ok: true }),
    },
  },
});
