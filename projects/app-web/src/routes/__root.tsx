import type { QueryClient } from '@tanstack/react-query';
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import type { OrpcQueryUtils } from '../lib/rpc/orpc';
// codegen (`panda cssgen`) writes this file; nothing else in the app imports it, so without this
// the page never links a stylesheet and every panda-generated class -- preflight, tokens, view
// transition rules included -- has no effect in the browser
import appStyles from '../styled-system/styles.css?url';

export interface RouterAppContext {
  readonly orpc: OrpcQueryUtils;
  readonly queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    links: [{ href: appStyles, rel: 'stylesheet' }],
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
