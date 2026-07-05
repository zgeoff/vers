import { Field as ArkField } from '@ark-ui/react/field';
import { cx, sva } from '@vers/styled-system/css';
import * as React from 'react';

interface Props {
  className?: string;
  errors: Array<string>;
  inputProps: React.ComponentProps<'input'> & { key?: React.Key };
  labelProps: React.ComponentProps<'label'>;
}

const fieldRecipe = sva({
  base: {
    errorText: {
      color: 'red.500',
      fontSize: 'sm',
    },
    input: {
      _focusVisible: {
        borderColor: 'gray.500',
        outline: 'none',
      },
      _invalid: {
        borderColor: 'red.500',
      },
      _placeholder: {
        color: 'gray.600',
      },
      backgroundColor: 'gray.900',
      borderColor: 'gray.700',
      borderWidth: '1',
      color: 'gray.300',
      outline: 'none',
      paddingX: '3',
      paddingY: '2',
      rounded: 'md',
      width: 'full',
    },
    label: {
      color: 'slate.200',
      fontFamily: 'karla',
      fontSize: 'sm',
      fontWeight: 'semibold',
      lineHeight: 'normal',
    },
    root: {
      display: 'flex',
      flexDirection: 'column',
      gap: '2',
      marginBottom: '3',
      maxWidth: '96',
    },
  },
  slots: ['root', 'label', 'input', 'errorText'],
});

export function Field(props: Props) {
  // the field context owns error wiring; callers' aria attributes are dropped
  // so they can't point at error elements that render elsewhere.
  const {
    'aria-describedby': _describedBy,
    'aria-invalid': _invalid,
    className,
    id,
    key,
    ...inputProps
  } = props.inputProps;

  const [firstError] = props.errors;
  const styles = fieldRecipe();

  return (
    <ArkField.Root
      className={cx(styles.root, props.className)}
      ids={id ? { control: id } : undefined}
      invalid={props.errors.length > 0}
    >
      <ArkField.Label
        {...props.labelProps}
        className={cx(styles.label, props.labelProps.className)}
      />
      <ArkField.Input {...inputProps} key={key} className={cx(styles.input, className)} />
      <ArkField.ErrorText className={styles.errorText}>{firstError}</ArkField.ErrorText>
    </ArkField.Root>
  );
}
