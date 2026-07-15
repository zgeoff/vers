import { expect, test } from 'bun:test';
import * as generators from './index';
import { previews } from './previews';

test('it has a preview entry for every template generator', () => {
  const expectedNames = Object.keys(generators)
    .filter((exportName) => exportName.startsWith('render'))
    .map((exportName) =>
      exportName
        .replace(/^render/, '')
        .replace(/Email$/, '')
        .replaceAll(/(?<=[a-z])(?=[A-Z])/g, '-')
        .toLowerCase(),
    );

  expect(previews.map((preview) => preview.name).toSorted()).toStrictEqual(
    expectedNames.toSorted(),
  );
});

test('it renders html and plain text for every preview entry', async () => {
  for (const preview of previews) {
    const rendered = await preview.render();

    expect(rendered.html).toInclude('<html');
    expect(rendered.plainText).not.toBe('');
  }
});
