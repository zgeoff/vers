import { createFileRoute } from '@tanstack/react-router';
import { sendRPCRequest } from '../../../../lib/proxy/send-rpc-request';
import type { ServiceName } from '../../../../lib/rpc/service-urls';
import { SERVICE_URLS } from '../../../../lib/rpc/service-urls';

/**
 * Forwards browser oRPC traffic to whichever service the `$service` segment names. Services
 * aren't reachable from the browser directly (private network in production), so every
 * client-lane call round-trips through this same-origin proxy; cookies ride along because the
 * browser's call to this route is same-origin.
 */
export const Route = createFileRoute('/api/rpc/$service/$')({
  server: {
    handlers: {
      ANY: (opts) => {
        if (!isServiceName(opts.params.service)) {
          return new Response(null, { status: 404 });
        }

        return sendRPCRequest(opts.request, opts.params.service);
      },
    },
  },
});

function isServiceName(value: string): value is ServiceName {
  return value in SERVICE_URLS;
}
