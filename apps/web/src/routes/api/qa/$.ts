import { createFileRoute } from '@tanstack/react-router';
import { sendQARequest } from '../../../lib/qa-seed/send-qa-request';
import { env } from '../../../server/env';

export const Route = createFileRoute('/api/qa/$')({
  server: {
    handlers: {
      ANY: (opts) => sendQARequest(opts.request, { configuredToken: env.QA_SEED_TOKEN }),
    },
  },
});
