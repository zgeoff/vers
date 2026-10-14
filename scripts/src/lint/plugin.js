const noUnportableMath = {
  meta: {
    type: 'problem',
    messages: {
      member:
        'Math.{{name}} is banned in the simulation. Use add, subtract, multiply, divide, Math.sqrt, Math.floor, Math.round, Math.min, or Math.max, or carry the value as an integer or per-mille fixed point.',
      exponent:
        'An exponent that is not an integer literal is banned in the simulation. Keep the exponent an integer literal, or carry the value as an integer or per-mille fixed point.',
      banned:
        '{{name}} is banned in the simulation. Carry the value as an integer or per-mille fixed point instead.',
      powReference:
        'Math.pow is allowed in the simulation only as a direct call, where its exponent can be checked.',
      dynamicMember:
        'A Math member chosen at runtime is banned in the simulation. Name the member directly so its use can be checked.',
      mathValue:
        'Math is allowed in the simulation only as Math.member. A stored or passed Math object hides its banned members.',
    },
    schema: [],
  },
  create(context) {
    return {
      "Identifier[name='Math']": (node) => {
        if (isGlobalReference(context, node)) {
          checkMathReference(context, node);
        }
      },
      "MemberExpression[object.name='globalThis']": (node) => {
        if (getMemberPropertyName(node) === 'Math' && isGlobalReference(context, node.object)) {
          checkMathReference(context, node);
        }
      },
      "BinaryExpression[operator='**']": (node) => {
        checkExponent(context, node, node.right);
      },
      "AssignmentExpression[operator='**=']": (node) => {
        checkExponent(context, node, node.right);
      },
      MemberExpression: (node) => {
        if (getMemberPropertyName(node) === 'toFixed') {
          reportBanned(context, node, 'toFixed');
        }
      },
      "CallExpression[callee.name='parseFloat']": (node) => {
        reportBanned(context, node, 'parseFloat');
      },
      "CallExpression[callee.object.name='Number'][callee.property.name='parseFloat']": (node) => {
        reportBanned(context, node, 'parseFloat');
      },
    };
  },
};

const plugin = {
  meta: { name: 'vers' },
  rules: {
    'no-unportable-math': noUnportableMath,
  },
};

export default plugin;

const bannedMathMembers = new Set([
  'exp',
  'expm1',
  'log',
  'log2',
  'log10',
  'log1p',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
  'hypot',
  'cbrt',
  'fround',
]);

function isGlobalReference(context, node) {
  for (let scope = context.sourceCode.getScope(node); scope !== null; scope = scope.upper) {
    const reference = scope.references.find((candidate) => candidate.identifier === node);

    if (reference !== undefined) {
      return reference.resolved === null || reference.resolved.defs.length === 0;
    }
  }

  return false;
}

function checkMathReference(context, node) {
  const parent = node.parent;

  if (parent.type === 'TSTypeQuery') {
    return;
  }

  if (parent.type === 'MemberExpression' && parent.object === node) {
    checkMathMember(context, parent);

    return;
  }

  const pattern = findDestructuringPattern(node);

  if (pattern === null) {
    context.report({ node, messageId: 'mathValue' });

    return;
  }

  for (const property of pattern.properties) {
    checkDestructuredProperty(context, property);
  }
}

function checkMathMember(context, node) {
  const name = getMemberPropertyName(node);

  if (name === undefined) {
    context.report({ node, messageId: 'dynamicMember' });

    return;
  }

  if (name === 'pow') {
    checkPowReference(context, node);

    return;
  }

  checkMathMemberName(context, node, name);
}

function checkPowReference(context, node) {
  const parent = node.parent;

  if (parent.type === 'CallExpression' && parent.callee === node) {
    checkExponent(context, parent, parent.arguments[1]);

    return;
  }

  context.report({ node, messageId: 'powReference' });
}

function checkMathMemberName(context, node, name) {
  if (bannedMathMembers.has(name)) {
    context.report({ node, messageId: 'member', data: { name } });
  }
}

function findDestructuringPattern(node) {
  const parent = node.parent;

  if (parent.type === 'VariableDeclarator' && parent.init === node) {
    return parent.id.type === 'ObjectPattern' ? parent.id : null;
  }

  if (
    (parent.type === 'AssignmentExpression' || parent.type === 'AssignmentPattern') &&
    parent.right === node
  ) {
    return parent.left.type === 'ObjectPattern' ? parent.left : null;
  }

  return null;
}

function checkDestructuredProperty(context, property) {
  if (property.type === 'RestElement') {
    context.report({ node: property, messageId: 'mathValue' });

    return;
  }

  const name = getPropertyKeyName(property);

  if (name === undefined) {
    context.report({ node: property, messageId: 'dynamicMember' });

    return;
  }

  if (name === 'pow') {
    context.report({ node: property, messageId: 'powReference' });

    return;
  }

  checkMathMemberName(context, property, name);
}

function getPropertyKeyName(property) {
  return !property.computed && property.key.type === 'Identifier'
    ? property.key.name
    : getStringLiteralValue(property.key);
}

function getMemberPropertyName(node) {
  if (!node.computed) {
    return node.property.name;
  }

  return getStringLiteralValue(node.property);
}

function getStringLiteralValue(node) {
  return node.type === 'Literal' && typeof node.value === 'string' ? node.value : undefined;
}

function checkExponent(context, node, exponentNode) {
  if (isIntegerLiteral(exponentNode)) {
    return;
  }

  context.report({ node, messageId: 'exponent' });
}

function isIntegerLiteral(node) {
  if (node === undefined) {
    return false;
  }

  const literal =
    node.type === 'UnaryExpression' && (node.operator === '-' || node.operator === '+')
      ? node.argument
      : node;

  return (
    literal.type === 'Literal' &&
    typeof literal.value === 'number' &&
    Number.isInteger(literal.value)
  );
}

function reportBanned(context, node, name) {
  context.report({ node, messageId: 'banned', data: { name } });
}
