import { createFileRoute, redirect } from '@tanstack/react-router';
import { runLogout } from './-logout/run-logout';

/**
 * `GET /logout` just bounces to the home page — signing out only ever happens via the `POST`
 * a logout form submits, so a bare navigation here can't accidentally end a session.
 */
export const Route = createFileRoute('/logout')({
  server: {
    handlers: {
      GET: () => redirect({ href: '/' }),
      POST: () => runLogout(),
    },
  },
});
