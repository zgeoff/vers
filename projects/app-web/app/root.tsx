import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from 'react-router';
import { HoneypotProvider } from 'remix-utils/honeypot/react';
import type { Route } from './+types/root';
import stylesheet from './app.css?url';
import fontsStylesheet from './fonts.css?url';
import { honeypot } from './honeypot.server';
import pandaStylesheet from './styled-system/styles.css?url';
import { useNonce } from './utils/nonce-provider';

export function links(): ReturnType<Route.LinksFunction> {
  return [
    { href: fontsStylesheet, rel: 'stylesheet' },
    { href: stylesheet, rel: 'stylesheet' },
    { href: pandaStylesheet, rel: 'stylesheet' },

    // {
    //   rel: 'icon',
    //   href: '/favicon.ico',
    //   sizes: '48x48',
    // },
    // { rel: 'icon', type: 'image/svg+xml', href: faviconAssetUrl },
    // { rel: 'apple-touch-icon', href: appleTouchIconAssetUrl },
    // {
    //   rel: 'manifest',
    //   href: '/site.webmanifest',
    //   crossOrigin: 'use-credentials',
    // } as const,
  ].filter(Boolean);
}

export function meta(): ReturnType<Route.MetaFunction> {
  return [
    {
      // oxlint-disable-next-line unicorn/text-encoding-identifier-case -- the html meta charset attribute value is the lowercase hyphenated form
      charset: 'utf-8',
      title: 'vers',
      viewport: 'width=device-width,initial-scale=1',
    },
  ];
}

export async function loader() {
  const honeyProps = await honeypot.getInputProps();

  return { honeyProps };
}

export function App() {
  const nonce = useNonce();

  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <div id="root">
          <Outlet />
        </div>
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export function AppWithProviders() {
  const data = useLoaderData<typeof loader>();

  return (
    <HoneypotProvider {...data.honeyProps}>
      <App />
    </HoneypotProvider>
  );
}

export default AppWithProviders;
