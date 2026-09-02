// A SessionStart hook for the `compact` source: tells the session that the skills it loaded before
// the compaction are gone, so the edit gate will refuse until they are reloaded.

console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext:
        'Context was compacted, and the skills loaded before it are no longer in context. Reload code-style, testing, or docs-writing with the Skill tool before the next edit under their paths; the edit gate refuses until you do.',
    },
  }),
);
