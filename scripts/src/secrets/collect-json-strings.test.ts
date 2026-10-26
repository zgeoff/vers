import { expect, test } from 'bun:test';
import { collectJSONStrings } from './collect-json-strings';

test('it collects every string value at any depth, decoded', () => {
  expect(
    collectJSONStrings(
      JSON.parse(
        String.raw`{"servers":{"tracker":{"args":["-c","op read \"op://ops/tracker/token\""],"port":3000,"debug":false}}}`,
      ),
    ),
  ).toStrictEqual(['-c', 'op read "op://ops/tracker/token"']);
});

test('it collects nothing from a document with no strings', () => {
  expect(collectJSONStrings(JSON.parse('{"retries":3,"enabled":true,"proxy":null}'))).toStrictEqual(
    [],
  );
});
