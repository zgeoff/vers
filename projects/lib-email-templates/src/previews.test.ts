import { expect, test } from 'vitest';
import * as generators from './index';
import { previews } from './previews';

test('it has a preview entry for every template generator', () => {
  const expectedNames = Object.keys(generators).map((exportName) =>
    exportName
      .replace(/^generate/, '')
      .replace(/Email$/, '')
      .replaceAll(/(?<=[a-z])(?=[A-Z])/g, '-')
      .toLowerCase(),
  );

  expect(previews.map((preview) => preview.name).sort()).toStrictEqual(
    expectedNames.sort(),
  );
});

test('it renders html and plain text for every preview entry', async () => {
  for (const preview of previews) {
    const { html, plainText } = await preview.render();

    expect(html).include('<html');
    expect(plainText).not.toBe('');
  }
});
