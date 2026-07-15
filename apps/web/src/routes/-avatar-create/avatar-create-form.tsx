import { useServerFn } from '@tanstack/react-start';
import type { AvatarMode } from '@vers/contract-avatar';
import { Field, Heading, StatusButton, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { useState } from 'react';
import { avatarCreate } from './avatar-create';
import type { AvatarCreateResult } from './types';

const formStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
  marginBottom: '6',
  width: '96',
});

const modeGroupStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  marginBottom: '3',
});

const modeOptionStyles = css({
  alignItems: 'center',
  display: 'flex',
  flexFlow: 'row nowrap',
  gap: '3',
});

const modeLabelStyles = css({
  color: 'text.primary',
  fontSize: 'md',
});

const modeWarningStyles = css({
  borderColor: 'border.danger',
  borderWidth: '[1px]',
  color: 'text.danger',
  fontSize: 'sm',
  padding: '3',
});

export function AvatarCreateForm() {
  const avatarCreateFn = useServerFn(avatarCreate);
  const [fieldErrors, setFieldErrors] = useState<AvatarCreateResult['fieldErrors']>({});
  const [isPending, setIsPending] = useState(false);
  const [mode, setMode] = useState<AvatarMode>('trade');

  const handleSubmit = async (form: HTMLFormElement) => {
    const formData = new FormData(form);

    setIsPending(true);
    setFieldErrors({});

    try {
      // a successful create ends in a redirect that useServerFn already navigated to, resolving
      // this call with no value — there's no further UI to show
      const result: AvatarCreateResult | undefined = await avatarCreateFn({ data: formData });

      if (result === undefined) {
        return;
      }

      setFieldErrors(result.fieldErrors);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <Heading level={1}>Create an Avatar</Heading>
      <form
        className={formStyles}
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(event.currentTarget);
        }}
      >
        <Field
          errors={fieldErrors.name === undefined ? [] : [fieldErrors.name]}
          inputProps={{
            autoComplete: 'off',
            autoFocus: true,
            id: 'name',
            name: 'name',
            placeholder: 'Enter your name',
          }}
          labelProps={{ children: 'Name', htmlFor: 'name' }}
        />
        <div className={modeGroupStyles} role="radiogroup" aria-label="Economy mode">
          <label className={modeOptionStyles}>
            <input
              checked={mode === 'trade'}
              name="mode"
              onChange={() => {
                setMode('trade');
              }}
              type="radio"
              value="trade"
            />
            <span className={modeLabelStyles}>Trade</span>
          </label>
          <label className={modeOptionStyles}>
            <input
              checked={mode === 'self_found'}
              name="mode"
              onChange={() => {
                setMode('self_found');
              }}
              type="radio"
              value="self_found"
            />
            <span className={modeLabelStyles}>Self-Found</span>
          </label>
          {mode === 'self_found' && (
            <Text className={modeWarningStyles} role="alert">
              Self-Found is permanent. Nothing this avatar earns can ever be traded, gifted, or
              moved to another avatar. A player who never trades loses nothing by staying Trade.
            </Text>
          )}
        </div>
        <StatusButton
          disabled={isPending}
          status={isPending ? StatusButton.Status.Pending : StatusButton.Status.Idle}
          type="submit"
          variant="primary"
          fullWidth
        >
          Create Avatar
        </StatusButton>
      </form>
    </>
  );
}
