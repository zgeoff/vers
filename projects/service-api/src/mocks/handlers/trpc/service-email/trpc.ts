import { createTRPCMsw, httpLink } from '@vafanassieff/msw-trpc';
import type { ServiceRouter } from '@vers/service-email';
import superjson from 'superjson';
import { env } from '../../../../env';

export const trpc = createTRPCMsw<ServiceRouter>({
  links: [
    httpLink({
      transformer: superjson,
      url: `${env.EMAILS_SERVICE_URL}trpc`,
    }),
  ],
  transformer: {
    input: superjson,
    output: superjson,
  },
});
