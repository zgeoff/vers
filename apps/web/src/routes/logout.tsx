import { createFileRoute, redirect } from '@tanstack/react-router';
import { runLogout } from './-logout/run-logout';

export const Route = createFileRoute('/logout')({
  server: {
    handlers: {
      GET: () => redirect({ href: '/' }),
      POST: () => runLogout(),
    },
  },
});
