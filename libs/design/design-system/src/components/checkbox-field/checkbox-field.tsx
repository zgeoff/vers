import { Checkbox } from '@ark-ui/react/checkbox';
import { Field } from '@ark-ui/react/field';
import { cx, sva } from '@vers/styled-system/css';
import * as React from 'react';
import { Icon } from '../icon/icon';

interface Props {
  checkboxProps: React.InputHTMLAttributes<HTMLInputElement> & { key?: React.Key };
  errors: ReadonlyArray<string>;
  labelProps: React.LabelHTMLAttributes<HTMLLabelElement>;
}

const checkboxFieldRecipe = sva({
  base: {
    checkbox: {
      alignItems: 'center',
      display: 'flex',
      flexFlow: 'row nowrap',
      gap: '3',
    },
    control: {
      '&[data-state=checked]': {
        backgroundColor: 'text.primary',
      },
      '&[data-state=unchecked]': {
        borderColor: 'border.strong',
        borderWidth: '[1px]',
      },
      alignItems: 'center',
      display: 'flex',
      height: '5',
      justifyContent: 'center',
      outline: 'none',
      width: '5',
    },
    errorText: {
      color: 'text.danger',
      fontSize: 'sm',
    },
    icon: {
      color: 'bg.panel',
    },
    indicator: {
      display: 'flex',
    },
    label: {
      color: 'text.primary',
      fontSize: 'md',
      fontWeight: 'normal',
      lineHeight: 'normal',
    },
    root: {
      alignItems: 'flex-start',
      display: 'flex',
      flexFlow: 'column',
      gap: '2',
      marginBottom: '3',
      maxWidth: '96',
    },
  },
  slots: ['root', 'checkbox', 'control', 'indicator', 'icon', 'label', 'errorText'],
});

export function CheckboxField(props: Readonly<Props>) {
  const [firstError] = props.errors;
  const onClick = props.checkboxProps.onClick;
  const styles = checkboxFieldRecipe();

  return (
    <Field.Root className={styles.root} invalid={props.errors.length > 0}>
      <Checkbox.Root
        checked={props.checkboxProps.checked}
        className={styles.checkbox}
        defaultChecked={props.checkboxProps.defaultChecked}
        disabled={props.checkboxProps.disabled}
        form={props.checkboxProps.form}
        ids={
          props.checkboxProps.id !== undefined && props.checkboxProps.id !== ''
            ? { hiddenInput: props.checkboxProps.id }
            : undefined
        }
        invalid={props.errors.length > 0}
        name={props.checkboxProps.name}
        required={props.checkboxProps.required}
      >
        <Checkbox.Control className={styles.control}>
          <Checkbox.Indicator className={styles.indicator}>
            <Icon.Checkmark className={styles.icon} size={16} />
          </Checkbox.Indicator>
        </Checkbox.Control>
        <Checkbox.Label
          {...props.labelProps}
          className={cx(styles.label, props.labelProps.className)}
        />
        <Checkbox.HiddenInput onClick={onClick} />
      </Checkbox.Root>
      <Field.ErrorText className={styles.errorText}>{firstError}</Field.ErrorText>
    </Field.Root>
  );
}
