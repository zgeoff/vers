import { createFileRoute } from '@tanstack/react-router';
import { EncounterPanel } from '../-encounter/encounter-panel';

export const Route = createFileRoute('/_game/encounter')({
  component: EncounterPanel,
  head: () => ({ meta: [{ title: 'vers | Encounter' }] }),
  staticData: { presentation: 'ambient' },
});
