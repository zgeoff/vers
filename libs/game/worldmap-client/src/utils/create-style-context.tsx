import { cx } from '@vers/styled-system/css';
import type { SlotRecipeRuntimeFn } from '@vers/styled-system/types/recipe';
import * as React from 'react';

type StyledComponent<T extends React.ElementType, TProps> = React.ForwardRefExoticComponent<
  React.PropsWithoutRef<React.ComponentPropsWithoutRef<T> & TProps> &
    React.RefAttributes<React.ComponentRef<T>>
>;

export function createStyleContext<TSlot extends string, TVariants extends object>(
  recipe: SlotRecipeRuntimeFn<TSlot, TVariants>,
) {
  const StyleContext = React.createContext<null | Record<TSlot, string>>(null);

  const withProvider = <T extends React.ElementType>(
    Component: T,
    slot?: TSlot,
  ): StyledComponent<T, TVariants> => {
    const ComponentWithStyles = React.forwardRef<
      React.ComponentRef<T>,
      React.ComponentPropsWithoutRef<T> & TVariants
      // oxlint-disable-next-line react/function-component-definition -- prefer-arrow-callback refuses the function expression this rule asks for
    >((props, ref) => {
      const [variantProps, restProps] = recipe.splitVariantProps(props);
      const slotStyles = recipe(variantProps);
      const slotClassName = slot === undefined ? undefined : slotStyles[slot];

      const className =
        'className' in restProps && typeof restProps['className'] === 'string'
          ? cx(slotClassName, restProps['className'])
          : slotClassName;

      return (
        <StyleContext.Provider value={slotStyles}>
          {React.createElement(Component, {
            ...restProps,
            className,
            ref,
          })}
        </StyleContext.Provider>
      );
    });

    ComponentWithStyles.displayName = `Styled${getComponentName(Component)}`;

    return ComponentWithStyles;
  };

  const withContext = <T extends React.ElementType>(
    Component: T,
    slot: TSlot,
  ): StyledComponent<T, object> => {
    const ComponentWithContext = React.forwardRef<
      React.ComponentRef<T>,
      React.ComponentPropsWithoutRef<T>
      // oxlint-disable-next-line react/function-component-definition -- prefer-arrow-callback refuses the function expression this rule asks for
    >((props, ref) => {
      const slotClassName = React.useContext(StyleContext)?.[slot];

      const className =
        'className' in props && typeof props['className'] === 'string'
          ? cx(slotClassName, props['className'])
          : slotClassName;

      return React.createElement(Component, {
        ...props,
        className,
        ref,
      });
    });

    ComponentWithContext.displayName = `Styled${getComponentName(Component)}`;

    return ComponentWithContext;
  };

  return { withContext, withProvider };
}

function getComponentName(Component: React.ElementType): string {
  if (typeof Component === 'string') {
    return Component;
  }

  if (Component.displayName !== undefined && Component.displayName !== '') {
    return Component.displayName;
  }

  return Component.name === '' ? 'Component' : Component.name;
}
