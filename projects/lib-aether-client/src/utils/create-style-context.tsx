import type { RecipeVariantProps } from '@vers/styled-system/css';
import { cx } from '@vers/styled-system/css';
import type { SlotRecipeRuntimeFn } from '@vers/styled-system/types/recipe';
import * as React from 'react';

type StyleRecipe = SlotRecipeRuntimeFn<string, Record<string, unknown>>;

type StyleSlotRecipe<R extends StyleRecipe> = ReturnType<R>;

type StyleSlot<R extends StyleRecipe> = keyof ReturnType<R>;

/**
 * Creates a style context for a given slot recipe and returns a pair of HOCs for
 * applying slot styles to a component. Useful for creating slot-based compound
 * components.
 *
 * @param recipe - The recipe to create a style context for.
 * @returns An object with two functions: `withContext` and `withProvider`.
 */
export function createStyleContext<R extends StyleRecipe>(recipe: R) {
  const StyleContext = React.createContext<null | StyleSlotRecipe<R>>(null);

  const withProvider = <T extends React.ElementType>(Component: T, slot?: StyleSlot<R>) => {
    const ComponentWithStyles = React.forwardRef<
      React.ComponentRef<T>,
      React.ComponentPropsWithoutRef<T> & RecipeVariantProps<R>
    >((props, ref) => {
      const [variantProps, restProps] = recipe.splitVariantProps(props);
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- calling a value of the generic type R returns its call signature's declared type, not ReturnType<R>; TS can't unify the two for a type parameter
      const slotStyles = recipe(variantProps) as StyleSlotRecipe<R>;

      const className =
        'className' in restProps && typeof restProps['className'] === 'string'
          ? cx(slotStyles[slot ?? ''], restProps['className'])
          : slotStyles[slot ?? ''];

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

  const withContext = <T extends React.ElementType>(Component: T, slot?: StyleSlot<R>): T => {
    if (slot === undefined) {
      return Component;
    }

    const StyledComponent = React.forwardRef<
      React.ComponentRef<T>,
      React.ComponentPropsWithoutRef<T>
    >((props, ref) => {
      const slotStyles = React.useContext(StyleContext);

      const className =
        'className' in props && typeof props['className'] === 'string'
          ? cx(slotStyles?.[slot ?? ''], props['className'])
          : slotStyles?.[slot ?? ''];

      return React.createElement(Component, {
        ...props,
        className,
        ref,
      });
    });

    StyledComponent.displayName = `Styled${getComponentName(Component)}`;

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- forwardRef's return type is a fixed ForwardRefExoticComponent that can't be expressed in terms of the caller's generic component type
    return StyledComponent as unknown as T;
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
