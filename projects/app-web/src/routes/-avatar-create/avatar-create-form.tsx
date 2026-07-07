import { useServerFn } from '@tanstack/react-start';
import type { ClassID } from '@vers/data';
import { Field, Heading, StatusButton } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { useState } from 'react';
import { avatarCreate } from './avatar-create';
import type { AvatarCreateResult } from './avatar-create-result';
import { ClassSelectionField } from './class-selection-field';

const formStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
  marginBottom: '6',
  width: '96',
});

/** The avatar-create page's client-interactive form: class selection plus a name, submitted together. */
export function AvatarCreateForm() {
  const avatarCreateFn = useServerFn(avatarCreate);
  const [selectedClass, setSelectedClass] = useState<ClassID | undefined>(undefined);
  const [fieldErrors, setFieldErrors] = useState<AvatarCreateResult['fieldErrors']>({});
  const [isPending, setIsPending] = useState(false);

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
        <input name="class" type="hidden" value={selectedClass ?? ''} />
        <ClassSelectionField
          error={fieldErrors.class}
          selected={selectedClass}
          onSelect={setSelectedClass}
        />
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
