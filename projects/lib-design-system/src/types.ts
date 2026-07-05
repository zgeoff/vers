export type PolymorphicComponentProps<C extends React.ElementType, Props = object> = Omit<
  React.ComponentPropsWithoutRef<C>,
  PropsToOmit<C, Props>
> &
  React.PropsWithChildren<AsProp<C> & Props>;

export type PolymorphicComponentPropsWithRef<
  C extends React.ElementType,
  Props = object,
> = PolymorphicComponentProps<C, Props> & { ref?: PolymorphicRef<C> };

type PolymorphicRef<C extends React.ElementType> = React.ComponentPropsWithRef<C>['ref'];

type PropsToOmit<C extends React.ElementType, P> = keyof (AsProp<C> & P);

interface AsProp<C extends React.ElementType> {
  as?: C;
}
