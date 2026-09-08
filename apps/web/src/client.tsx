// first so it runs before any imported module builds a schema
import '@vers/utils/disable-zod-jit';
import { StartClient } from '@tanstack/react-start/client';
import { StrictMode, startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { startSentryReact } from './start-sentry-react';

startSentryReact();

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
});
