import { createFileRoute } from '@tanstack/react-router';
import type { ServiceName } from '@vers/service-auth';
import { sendRPCRequest } from '../../../../lib/proxy/send-rpc-request';
import { SERVICE_URLS } from '../../../../lib/rpc/service-urls';

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
