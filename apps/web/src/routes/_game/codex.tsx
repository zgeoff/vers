import { createFileRoute } from '@tanstack/react-router';
import { CodexPanel } from '../-codex/codex-panel';

export const Route = createFileRoute('/_game/codex')({
  component: CodexPanel,
  head: () => ({ meta: [{ title: 'vers | Codex' }] }),
  staticData: { presentation: 'ambient' },
});
