import { createServerFn } from '@tanstack/react-start';
import { buildHoneypotValidFrom } from './build-honeypot-valid-from';

/**
 * Issues a form's `valid-from` timestamp from the server, so the value a route ships and the value
 * the submission check compares it against are read from the same clock. Routes call this in their
 * loader and pass the result down as loader data: computing it while rendering would let hydration
 * recompute it against the browser's clock, and a caller whose device clock runs ahead of the
 * server would then be rejected as a bot on every auth form.
 */
export const getHoneypotValidFrom = createServerFn({ method: 'GET' }).handler(() =>
  buildHoneypotValidFrom(),
);
