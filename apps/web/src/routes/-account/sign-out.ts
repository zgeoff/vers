import { createServerFn } from '@tanstack/react-start';
import { runLogout } from '../../lib/auth/run-logout';

/**
 * The account hub's sign-out action.
 */
export const signOut = createServerFn({ method: 'POST' }).handler(() =>
  runLogout({ deleteSession: true }),
);
