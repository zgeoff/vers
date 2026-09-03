import { createServerFn } from '@tanstack/react-start';
import { runLogout } from '../../lib/auth/run-logout';

export const signOut = createServerFn({ method: 'POST' }).handler(() =>
  runLogout({ deleteSession: true }),
);
