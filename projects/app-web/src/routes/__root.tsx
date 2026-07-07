import type { QueryClient } from '@tanstack/react-query';
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import type { OrpcQueryUtils } from '../lib/rpc/query-utils';

/** Router context every route can read: the SSR-hydrated query client and namespaced oRPC utils. */
export interface RouterAppContext {
  readonly orpc: OrpcQueryUtils;
  readonly queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    meta: [
      { charSet: 'utf8' },
      { content: 'width=device-width, initial-scale=1', name: 'viewport' },
      { title: 'vers' },
    ],
  }),
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

/** The routed page content mounted inside the document shell. */
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
        {props.children}
        <Scripts />
      </body>
    </html>
  );
}
