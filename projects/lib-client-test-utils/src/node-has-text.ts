export function nodeHasText(text: string) {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  return (_: string, node: Element | null) => node?.textContent === text;
}
