import type { AvatarData } from '@vers/contract-avatar';
import { Heading } from '@vers/design-system';
import type { ReactElement } from 'react';

interface AvatarContentProps {
  readonly avatar: AvatarData;
}

export function AvatarContent(props: AvatarContentProps): ReactElement {
  return (
    <section>
      <Heading level={1}>{props.avatar.name}</Heading>
    </section>
  );
}
