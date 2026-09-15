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
    },
    schema: [],
  },
  create(context) {
    return {
      "MemberExpression[object.name='Math']": (node) => {
        checkMathMember(context, node);
      },
      "CallExpression[callee.object.name='Math'][callee.property.name='pow']": (node) => {
        checkExponent(context, node, node.arguments[1]);
      },
      "BinaryExpression[operator='**']": (node) => {
        checkExponent(context, node, node.right);
      },
      "MemberExpression[property.name='toFixed'][computed=false]": (node) => {
        reportBanned(context, node, 'toFixed');
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

function checkMathMember(context, node) {
  const name = getMathMemberName(node);

  if (name === undefined || !bannedMathMembers.has(name)) {
    return;
  }

  context.report({ node, messageId: 'member', data: { name } });
}

function getMathMemberName(node) {
  if (!node.computed) {
    return node.property.name;
  }

  return node.property.type === 'Literal' && typeof node.property.value === 'string'
    ? node.property.value
    : undefined;
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
