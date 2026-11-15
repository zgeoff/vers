import { createFileRoute } from '@tanstack/react-router';
import { readServedCommit } from '../server/read-served-commit';

export const Route = createFileRoute('/health')({
  server: {
    handlers: {
      GET: () => Response.json({ ok: true, commit: readServedCommit() }),
    },
  },
});
