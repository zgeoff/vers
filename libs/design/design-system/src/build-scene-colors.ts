interface ColorTokenSource {
  semanticTokens: unknown;
  tokens: unknown;
}

export function buildSceneColors(colors: ColorTokenSource): Record<string, string> {
  const sceneGroup = findTokenNode(colors, ['scene']);

  if (!isTokenGroup(sceneGroup) || isTokenLeaf(sceneGroup)) {
    throw new Error('the preset has no scene colour token group');
  }

  return Object.fromEntries(
    Object.keys(sceneGroup).map((name) => [name, resolveSceneColor(colors, ['scene', name], [])]),
  );
}

function findTokenNode(colors: ColorTokenSource, path: Array<string>): unknown {
  return findChild(colors.semanticTokens, path) ?? findChild(colors.tokens, path);
}

function findChild(tree: unknown, path: Array<string>): unknown {
  return path.reduce<unknown>(
    (node, key) => (isTokenGroup(node) && !isTokenLeaf(node) ? node[key] : undefined),
    tree,
  );
}

function isTokenGroup(node: unknown): node is Record<string, unknown> {
  return typeof node === 'object' && node !== null;
}

function isTokenLeaf(node: unknown): node is { value: string } {
  return isTokenGroup(node) && typeof node['value'] === 'string';
}

const HEX_COLOR = /^#[\da-f]{6}$/iu;
const TOKEN_REFERENCE = /^\{colors\.(?<path>[^{}]+)\}$/u;

function resolveSceneColor(
  colors: ColorTokenSource,
  path: Array<string>,
  seen: Array<string>,
): string {
  const name = `colors.${path.join('.')}`;

  if (seen.includes(name)) {
    throw new Error(`the colour token ${name} refers to itself through ${seen.join(' -> ')}`);
  }

  const node = findTokenNode(colors, path);
  const leaf = isTokenGroup(node) && !isTokenLeaf(node) ? node['DEFAULT'] : node;

  if (!isTokenLeaf(leaf)) {
    throw new Error(`the colour token ${name} does not exist in the preset`);
  }

  const reference = TOKEN_REFERENCE.exec(leaf.value)?.groups?.['path'];

  if (reference !== undefined) {
    return resolveSceneColor(colors, reference.split('.'), [...seen, name]);
  }

  if (!HEX_COLOR.test(leaf.value)) {
    throw new Error(`the colour token ${name} is ${leaf.value}, not a #rrggbb hex colour`);
  }

  return leaf.value.toLowerCase();
}
