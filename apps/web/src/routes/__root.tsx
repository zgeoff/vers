import type { QueryClient } from '@tanstack/react-query';
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { HydrationMarker } from '../components/hydration-marker';
import { RootErrorScreen } from '../components/root-error-screen';
import { buildUmamiScripts } from '../lib/build-umami-scripts';
import type { OrpcQueryUtils } from '../lib/rpc/orpc';
import appStyles from '../styled-system/styles.css?url';

export interface RouterAppContext {
  readonly orpc: OrpcQueryUtils;
  readonly queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  errorComponent: RootErrorScreen,
  head: () => ({
    links: [{ href: appStyles, rel: 'stylesheet' }],
    meta: [
      { charSet: 'utf8' },
      { content: 'width=device-width, initial-scale=1', name: 'viewport' },
      { title: 'vers' },
    ],
    scripts: buildUmamiScripts(import.meta.env['VITE_UMAMI_WEBSITE_ID']),
  }),
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

interface RootDocumentProps {
  readonly children: ReactNode;
}

function RootDocument(props: RootDocumentProps) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <HydrationMarker />
        {props.children}
        <Scripts />
      </body>
    </html>
  );
}
