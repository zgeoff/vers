export type PolymorphicComponentProps<C extends React.ElementType, Props = object> = Omit<
  React.ComponentPropsWithoutRef<C>,
  PropsToOmit<C, Props>
> &
  React.PropsWithChildren<AsProp<C> & Props>;

type PropsToOmit<C extends React.ElementType, P> = keyof (AsProp<C> & P);

interface AsProp<C extends React.ElementType> {
  as?: C;
}
