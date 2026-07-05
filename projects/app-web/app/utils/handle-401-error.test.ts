import { CombinedError } from '@urql/core';
import { afterEach, expect, test, vi } from 'vitest';
import { handle401Error } from './handle-401-error';
import * as logoutModule from './logout.server';

const logoutSpy = vi.spyOn(logoutModule, 'logout');

afterEach(() => {
  vi.restoreAllMocks();
});

test('it logs the user out and redirects to the login page with the current URL as the redirect when the error is a 401', async () => {
  const request = new Request('http://localhost:3000/nexus?test=true');

  const response = new Response(null, { status: 401 });
  const error = new CombinedError({ response });

  await expect(handle401Error(request, error)).rejects.toStrictEqual(
    new Response(null, {
      headers: {
        Location: '/login?redirect=%2Fnexus%3Ftest%3Dtrue',
      },
      status: 302,
    }),
  );

  expect(logoutSpy).toHaveBeenCalledExactlyOnceWith(request, {
    redirectTo: '/login?redirect=%2Fnexus%3Ftest%3Dtrue',
  });
});

test('it does not log out the user when the error is not a 401', async () => {
  const request = new Request('http://localhost:3000/nexus');

  const error = new Error('test');

  await expect(handle401Error(request, error)).resolves.toBeUndefined();

  expect(logoutSpy).not.toHaveBeenCalled();
});
