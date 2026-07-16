import type { JSX } from 'react';
import { UMAMI_PATHS } from './umami-paths';

type UmamiScriptTag = JSX.IntrinsicElements['script'] & {
  readonly 'data-host-url': string;
  readonly 'data-website-id': string;
};

/**
 * Builds the root route's analytics script tags: the Umami tracker, deferred, loaded through the
 * server's same-origin proxy and pointed at its website ID. A missing ID — every non-production
 * build — yields no tags, so dev and e2e traffic never reaches analytics. Rendered through
 * `HeadContent`, the tag carries the per-request CSP nonce.
 */
export function buildUmamiScripts(websiteID: string | undefined): Array<UmamiScriptTag> {
  if (websiteID === undefined) {
    return [];
  }

  return [
    {
      'data-host-url': UMAMI_PATHS.hostURL,
      'data-website-id': websiteID,
      defer: true,
      src: UMAMI_PATHS.script,
    },
  ];
}
