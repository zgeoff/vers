import { redirect } from 'react-router';
import { RouteErrorBoundary } from '../../components/route-error-boundary';
import { Routes } from '../../types';
import { logout } from '../../utils/logout.server';
import type { Route } from './+types/route';

export function loader() {
  return redirect(Routes.Index);
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function action(args: Route.ActionArgs) {
  return logout(args.request, { deleteSession: true });
}

export function ErrorBoundary() {
  return <RouteErrorBoundary />;
}
