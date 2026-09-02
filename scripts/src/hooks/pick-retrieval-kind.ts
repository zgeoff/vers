import path from 'node:path';
import type { RetrievalKind } from './types';

const CODE_EXTENSIONS: ReadonlySet<string> = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);

const SERENA_PREFIX = 'mcp__serena__';

const SERENA_LOOKUPS: ReadonlySet<string> = new Set([
  'find_symbol',
  'get_symbols_overview',
  'find_referencing_symbols',
  'find_declaration',
  'find_implementations',
]);

const SERENA_EDITS: ReadonlySet<string> = new Set([
  'replace_symbol_body',
  'insert_after_symbol',
  'insert_before_symbol',
  'rename_symbol',
  'safe_delete_symbol',
]);

const BUILTIN_EDITS: ReadonlySet<string> = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

// A search command at the start of the line or after a pipe, separator, or subshell open.
const SHELL_SEARCH_PATTERN = /(?:^|[\s|;&(])(?:rg|grep|egrep|fgrep|ag|ugrep|ack)(?:\s|$)/;

/**
 * Picks what a tool call means to the retrieval policy from its name and input. Only runtime code
 * files count for reads and edits: a Read or Edit of markdown, YAML, JSON, or SQL is `other`.
 */
export function pickRetrievalKind(
  toolName: string,
  toolInput: Readonly<Record<string, unknown>>,
): RetrievalKind {
  if (toolName.startsWith(SERENA_PREFIX)) {
    const tool = toolName.slice(SERENA_PREFIX.length);

    if (SERENA_LOOKUPS.has(tool)) {
      return 'symbol-lookup';
    }

    return SERENA_EDITS.has(tool) ? 'symbol-edit' : 'other';
  }

  if (toolName === 'Grep') {
    return 'search';
  }

  if (toolName === 'Bash') {
    return isShellSearch(toolInput['command']) ? 'search' : 'other';
  }

  if (toolName === 'Read') {
    if (!isCodePath(toolInput['file_path'])) {
      return 'other';
    }

    const ranged = toolInput['offset'] !== undefined || toolInput['limit'] !== undefined;

    return ranged ? 'read-ranged' : 'read-whole';
  }

  if (BUILTIN_EDITS.has(toolName)) {
    return isCodePath(toolInput['file_path'] ?? toolInput['notebook_path']) ? 'edit' : 'other';
  }

  return 'other';
}

function isShellSearch(command: unknown): boolean {
  return typeof command === 'string' && SHELL_SEARCH_PATTERN.test(command);
}

function isCodePath(filePath: unknown): boolean {
  return typeof filePath === 'string' && CODE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}
