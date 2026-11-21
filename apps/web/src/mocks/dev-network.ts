import { defineNetwork } from 'msw/experimental';
import { defaultNetworkOptions } from 'msw/node';
import { handlers } from './handlers';

// the mock backend of the dev server: it answers the requests that a handler matches and lets every
// other one through. `vite.config.ts` enables it; tests use the network in `network.ts`.
export const network = defineNetwork({
  ...defaultNetworkOptions,
  handlers,
  onUnhandledFrame: 'bypass',
});
