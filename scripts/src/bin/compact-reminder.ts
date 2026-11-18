// a compaction drops the skills the session loaded, and the edit gate refuses until they are
// reloaded

console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext:
        'Context was compacted, and the skills loaded before it are no longer in context. Reload code-style, testing, docs-writing, or project-docs-writing with the Skill tool before the next edit under their paths; the edit gate refuses until you do.',
    },
  }),
);
