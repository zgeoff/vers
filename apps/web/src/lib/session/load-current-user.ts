import { createServerFn } from '@tanstack/react-start';
import { readCurrentUser } from './read-current-user';

/**
 * Keeps the cookie read on the server for a client-side navigation back to `/`, where the browser
 * cannot read the HttpOnly session cookie itself.
 */
export const loadCurrentUser = createServerFn({ method: 'GET' }).handler(() => readCurrentUser());
