import * as React from 'react';
import type { RecipeVariantProps } from '@vers/styled-system/css';
import type {
  SlotRecipeRuntimeFn,
  SlotRecipeVariantRecord,
} from '@vers/styled-system/types/recipe';
import { cx } from '@vers/styled-system/css';

type StyleRecipe = SlotRecipeRuntimeFn<string, SlotRecipeVariantRecord<string>>;

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

  const withProvider = <T extends React.ElementType>(
    Component: T,
    slot?: StyleSlot<R>,
  ) => {
    const ComponentWithStyles = React.forwardRef<
      React.ComponentRef<T>,
      React.ComponentPropsWithoutRef<T> & RecipeVariantProps<R>
    >((props, ref) => {
      const [variantProps, restProps] = recipe.splitVariantProps(props);
      const slotStyles = recipe(variantProps) as StyleSlotRecipe<R>;

      const className =
        'className' in restProps && typeof restProps.className === 'string'
          ? cx(slotStyles[slot ?? ''], restProps.className)
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

  const withContext = <T extends React.ElementType>(
    Component: T,
    slot?: StyleSlot<R>,
  ): T => {
    if (!slot) {
      return Component;
    }

    const StyledComponent = React.forwardRef<
      React.ComponentRef<T>,
      React.ComponentPropsWithoutRef<T>
    >((props, ref) => {
      const slotStyles = React.useContext(StyleContext);

      const className =
        'className' in props && typeof props.className === 'string'
          ? cx(slotStyles?.[slot ?? ''], props.className)
          : slotStyles?.[slot ?? ''];

      return React.createElement(Component, {
        ...props,
        className,
        ref,
      });
    });

    StyledComponent.displayName = `Styled${getComponentName(Component)}`;

    return StyledComponent as unknown as T;
  };

  return { withContext, withProvider };
}

function getComponentName(Component: React.ElementType) {
  return typeof Component === 'string'
    ? Component
    : Component.displayName || Component.name || 'Component';
}
