import { expect, test } from 'bun:test';
import { createMockAvatarData } from '@vers/contract-avatar/test-utils';
import { render } from '../../test-utils/render';
import { AvatarContent } from './avatar-content';

test('it shows the avatar name', () => {
  const avatar = createMockAvatarData({ name: 'Karnak' });
  const rendered = render(<AvatarContent avatar={avatar} />);

  expect(rendered.getByText('Karnak')).toBeVisible();
});
