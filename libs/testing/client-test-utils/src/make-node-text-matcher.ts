export function makeNodeTextMatcher(text: string) {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- DOM handle; readonly is semantically meaningless on a live Element
  return (_: string, node: Element | null) => node?.textContent === text;
}
