import { createServerFn } from '@tanstack/react-start';
import { buildHoneypotValidFrom } from './build-honeypot-valid-from';

// issued from a loader, never computed during render: hydration would recompute a render-time value
// against the browser's clock, and a device clock ahead of the server's would then fail every auth
// form as a bot
export const getHoneypotValidFrom = createServerFn({ method: 'GET' }).handler(() =>
  buildHoneypotValidFrom(),
);
