import { Checkbox } from '@ark-ui/react/checkbox';
import { Field } from '@ark-ui/react/field';
import { cx, sva } from '@vers/styled-system/css';
import * as React from 'react';
import { Icon } from '../icon/icon';

interface Props {
  checkboxProps: React.ComponentProps<'input'> & { key?: React.Key };
  errors: Array<string>;
  labelProps: React.ComponentProps<'label'>;
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
        backgroundColor: 'neutral.200',
      },
      '&[data-state=unchecked]': {
        borderColor: 'neutral.200',
        borderWidth: '[1px]',
      },
      alignItems: 'center',
      display: 'flex',
      height: '5',
      justifyContent: 'center',
      outline: 'none',
      rounded: 'sm',
      width: '5',
    },
    errorText: {
      color: 'red.500',
      fontSize: 'sm',
    },
    icon: {
      color: 'neutral.900',
    },
    indicator: {
      display: 'flex',
    },
    label: {
      color: 'slate.200',
      fontFamily: 'karla',
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

export function CheckboxField(props: Props) {
  const { checked, defaultChecked, disabled, form, id, name, onClick, required } =
    props.checkboxProps;

  const [firstError] = props.errors;
  const styles = checkboxFieldRecipe();

  return (
    <Field.Root className={styles.root} invalid={props.errors.length > 0}>
      <Checkbox.Root
        checked={checked}
        className={styles.checkbox}
        defaultChecked={defaultChecked}
        disabled={disabled}
        form={form}
        ids={id ? { hiddenInput: id } : undefined}
        invalid={props.errors.length > 0}
        name={name}
        required={required}
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
