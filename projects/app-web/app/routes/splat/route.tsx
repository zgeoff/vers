import { RouteErrorBoundary } from '../../components/route-error-boundary';

// when the user hits a URL that doesn't exist, we want to throw a 404 error
// this route will be matched to a "splat" route that can be used as a catch all
// for all requests to routes that don't otherwise match. when we hit it, we throw
// a 404 which will trigger the error boundary to render.
export function loader() {
  throw new Response('Not found', { status: 404 });
}

export function action() {
  throw new Response('Not found', { status: 404 });
}

export function NotFound() {
  // due to the loader, this component will never be rendered, but we'll return
  // the error boundary just in case.
  return <ErrorBoundary />;
}

export function ErrorBoundary() {
  return <RouteErrorBoundary />;
}

export default NotFound;
