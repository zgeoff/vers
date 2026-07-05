import { useActionData, useLoaderData, useParams } from 'react-router';
import type * as T from 'react-router/route-module';

type RouteProps = T.CreateComponentProps<{
  actionData: unknown;
  file: string;
  id: unknown;
  loaderData: unknown;
  matches: [];
  module: Record<string, unknown>;
  params: unknown;
  parents: [];
  path: string;
}>;

export function withRouteProps<TProps extends RouteProps = RouteProps>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  WrappedComponent: React.ComponentType<TProps>,
) {
  const displayName = WrappedComponent.displayName ?? WrappedComponent.name;

  const ComponentWithRouteProps = () => {
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    const actionData = useActionData();
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    const loaderData = useLoaderData();
    const params = useParams();

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- baseline(#236)
    const routeProps = {
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
      actionData,
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
      loaderData,
      matches: [],
      params,

      // just cast it - typing it's a nightmare
    } as unknown as TProps;

    return <WrappedComponent {...routeProps} />;
  };

  ComponentWithRouteProps.displayName = `withRouteProps(${displayName})`;

  return ComponentWithRouteProps;
}
