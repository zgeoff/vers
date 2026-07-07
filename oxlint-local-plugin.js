// Repo-local lint rules, loaded through oxlint's jsPlugins (ESLint v9 rule
// API). Each rule bans an AST shape that no native oxlint rule can express,
// using esquery selectors.

function banSelectors(type, message, selectors) {
  return {
    meta: { type, messages: { banned: message }, schema: [] },
    create(context) {
      const entries = selectors.map((selector) => [
        selector,
        (node) => context.report({ node, messageId: 'banned' }),
      ]);

      return Object.fromEntries(entries);
    },
  };
}

const plugin = {
  meta: { name: 'local' },
  rules: {
    'no-top-level-arrow': banSelectors(
      'problem',
      'Declare top-level functions with the `function` keyword instead of assigning an arrow function.',
      [
        "Program > VariableDeclaration > VariableDeclarator[init.type='ArrowFunctionExpression']",
        "Program > ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[init.type='ArrowFunctionExpression']",
        'Program > ExportDefaultDeclaration > ArrowFunctionExpression',
        "Program > ExpressionStatement > AssignmentExpression[right.type='ArrowFunctionExpression']",
      ],
    ),
    'no-nested-function-declaration': banSelectors(
      'problem',
      'Use an arrow function here; reserve the `function` keyword for top-level declarations.',
      [
        'FunctionDeclaration:not(Program > FunctionDeclaration):not(Program > ExportNamedDeclaration > FunctionDeclaration):not(Program > ExportDefaultDeclaration > FunctionDeclaration)',
      ],
    ),
    'no-bare-named-exports': banSelectors(
      'problem',
      'Export declarations inline instead of listing names in `export { ... }`.',
      ['ExportNamedDeclaration[specifiers.length>0][declaration=null][source=null]'],
    ),
    'no-inline-param-object-types': banSelectors(
      'problem',
      'Give this parameter a named interface or type alias instead of an inline object-literal type.',
      [
        ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression, TSDeclareFunction, TSFunctionType) > Identifier.params > TSTypeAnnotation > TSTypeLiteral',
        'TSMethodSignature > Identifier.params > TSTypeAnnotation > TSTypeLiteral',
      ],
    ),
    'no-destructured-params': banSelectors(
      'suggestion',
      'Accept the parameter whole instead of destructuring it in the signature.',
      [
        ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression) > ObjectPattern.params',
        ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression) > AssignmentPattern.params > ObjectPattern',
      ],
    ),
    'no-pick-destructuring': banSelectors(
      'suggestion',
      'Use direct member access; destructure an object only with a rest element to omit properties.',
      ['VariableDeclarator > ObjectPattern:not(:has(> RestElement))'],
    ),
    'no-ternary-args': banSelectors(
      'suggestion',
      'Extract this ternary to a named const instead of passing it as an argument.',
      [
        'CallExpression > ConditionalExpression.arguments',
        'NewExpression > ConditionalExpression.arguments',
      ],
    ),
    'no-await-args': banSelectors(
      'suggestion',
      'Await into a named const instead of awaiting inside an argument list.',
      ['CallExpression > AwaitExpression.arguments', 'NewExpression > AwaitExpression.arguments'],
    ),
  },
};

export default plugin;
