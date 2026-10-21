import { deleteCookie, getCookie, getRequest, setCookie } from '@tanstack/react-start/server';
import type { CookieJar } from 'iron-session';

const writtenCookies = new WeakMap<Request, Map<string, string>>();

export function createSessionCookieJar(): CookieJar {
  const request = getRequest();
  const written = writtenCookies.get(request) ?? new Map<string, string>();

  writtenCookies.set(request, written);

  return {
    // Start reads a cookie from the request header alone, so without this a session written
    // earlier in the same request reads back as the value the browser sent
    read: (name) => written.get(name) ?? getCookie(name),

    write: (name, value, options) => {
      const { maxAge, ...attributes } = options;

      written.set(name, value);

      if (maxAge === 0) {
        deleteCookie(name, attributes);
      } else {
        setCookie(name, value, { ...attributes, ...(maxAge !== undefined && { maxAge }) });
      }
    },
  };
}
