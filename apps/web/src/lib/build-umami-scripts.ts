import type { JSX } from 'react';
import { UMAMI_PATHS } from './umami-paths';

type UmamiScriptTag = JSX.IntrinsicElements['script'] & {
  readonly 'data-host-url': string;
  readonly 'data-website-id': string;
};

export function buildUmamiScripts(websiteID: string | undefined): Array<UmamiScriptTag> {
  if (websiteID === undefined || websiteID.trim() === '') {
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
