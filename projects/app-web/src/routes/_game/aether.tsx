import { createFileRoute } from '@tanstack/react-router';
import { AetherPanel } from '../-aether/aether-panel';

export const Route = createFileRoute('/_game/aether')({
  component: AetherPanel,
  head: () => ({ meta: [{ title: 'vers | Aether' }] }),
});
