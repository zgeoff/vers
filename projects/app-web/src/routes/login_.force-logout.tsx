import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/login_/force-logout')({
  component: () => <div>force logout</div>,
});
