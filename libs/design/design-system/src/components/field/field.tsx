import { Field as ArkField } from '@ark-ui/react/field';
import { cx, sva } from '@vers/styled-system/css';
import * as React from 'react';

interface Props {
  className?: string;
  errors: ReadonlyArray<string>;
  inputProps: React.InputHTMLAttributes<HTMLInputElement> & { key?: React.Key };
  labelProps: React.LabelHTMLAttributes<HTMLLabelElement>;
}

const fieldRecipe = sva({
  base: {
    errorText: {
      color: 'text.danger',
      fontSize: 'sm',
    },
    input: {
      _focusVisible: {
        borderColor: 'border.strong',
        outline: 'none',
      },
      _invalid: {
        borderColor: 'border.danger',
      },
      _placeholder: {
        color: 'text.faint',
      },
      backgroundColor: 'bg.panel',
      borderColor: 'border',
      borderWidth: '[1px]',
      color: 'text.primary',
      outline: 'none',
      paddingX: '3',
      paddingY: '2',
      width: 'full',
    },
    label: {
      color: 'text.primary',
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

export function Field(props: Readonly<Props>) {
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
      id={id}
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
