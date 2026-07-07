import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/logout')({
  component: () => <div>logout</div>,
});
