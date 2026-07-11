import { Field } from '@ark-ui/react/field';
import { PinInput } from '@ark-ui/react/pin-input';
import { cx, sva } from '@vers/styled-system/css';
import * as React from 'react';

interface Props {
  className?: string;
  errors: ReadonlyArray<string>;
  inputProps: React.InputHTMLAttributes<HTMLInputElement> & {
    key?: React.Key;
    mode?: 'alphanumeric' | 'numeric';
  };
}

const otpFieldRecipe = sva({
  base: {
    control: {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'row',
      gap: '2',
    },
    errorText: {
      color: 'text.danger',
      fontSize: 'sm',
    },
    group: {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'row',
      gap: '2',
    },
    input: {
      _disabled: {
        cursor: '[not-allowed]',
      },
      _focusVisible: {
        borderColor: 'border.strong',
        outline: 'none',
        zIndex: '[10]',
      },
      backgroundColor: 'bg.panel',
      borderColor: 'border',
      borderWidth: '[1px]',
      color: 'text.primary',
      fontSize: 'md',
      height: '11',
      lineHeight: 'normal',
      textAlign: 'center',
      textTransform: 'uppercase',
      width: '9',
    },
    root: {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      gap: '2',
      justifyContent: 'center',
      marginBottom: '4',
    },
    separator: {
      backgroundColor: 'border.strong',

      // preflight gives hr a 1px top border in text color — zero it so the
      // separator renders as a plain dot
      borderTopWidth: '[0]',
      height: '1',
      width: '1',
    },
  },
  slots: ['root', 'control', 'group', 'input', 'separator', 'errorText'],
});

export function OTPField(props: Readonly<Props>) {
  const { autoFocus, defaultValue, id, key, mode, name, ...hiddenInputProps } = props.inputProps;
  const [firstError] = props.errors;
  const styles = otpFieldRecipe();

  return (
    <Field.Root className={cx(styles.root, props.className)} invalid={props.errors.length > 0}>
      <PinInput.Root
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- opt-in per form; code entry is the page's sole action
        autoFocus={autoFocus}
        // oxlint-disable-next-line typescript/no-misused-spread -- unicorn/prefer-spread bans the Array.from() alternative; spread is also the Unicode-code-point-safe way to split the code into per-digit characters
        defaultValue={typeof defaultValue === 'string' ? [...defaultValue] : undefined}
        ids={id !== undefined && id !== '' ? { hiddenInput: id } : undefined}
        invalid={props.errors.length > 0}
        name={name}
        placeholder=""
        type={mode === 'alphanumeric' ? 'alphanumeric' : 'numeric'}
        otp
      >
        <PinInput.Control className={styles.control}>
          <div className={styles.group}>
            {/* a multi-character change on this input is treated as a paste
                and distributed across all six inputs, so e2e fills target it */}
            <PinInput.Input className={styles.input} data-testid="otp-input" index={0} />
            <PinInput.Input className={styles.input} index={1} />
            <PinInput.Input className={styles.input} index={2} />
          </div>
          <hr className={styles.separator} />
          <div className={styles.group}>
            <PinInput.Input className={styles.input} index={3} />
            <PinInput.Input className={styles.input} index={4} />
            <PinInput.Input className={styles.input} index={5} />
          </div>
        </PinInput.Control>
        <PinInput.HiddenInput {...hiddenInputProps} key={key} />
      </PinInput.Root>
      <Field.ErrorText className={styles.errorText}>{firstError}</Field.ErrorText>
    </Field.Root>
  );
}
