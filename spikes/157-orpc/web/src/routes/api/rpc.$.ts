import { createFileRoute } from '@tanstack/react-router';

/**
 * Forwards browser oRPC traffic to the user service, which is not directly reachable from the
 * browser (in production it lives on the private network). Cookies ride along because the
 * browser calls this route same-origin.
 */
export const Route = createFileRoute('/api/rpc/$')({
  server: {
    handlers: {
      ANY: async ({ request }) => {
        const incoming = new URL(request.url);
        const serviceOrigin =
          process.env.SERVICE_URL ?? 'http://localhost:3001';
        const target = new URL(
          incoming.pathname.replace(/^\/api\/rpc/, '/rpc') + incoming.search,
          serviceOrigin,
        );
        const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
        return fetch(target, {
          method: request.method,
          headers: request.headers,
          body: hasBody ? await request.blob() : undefined,
        });
      },
    },
  },
});
