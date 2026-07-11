---
name: docs-writing
description:
  Writing rules for repo prose — AGENTS.md and agents/ partials, docs/, README content, and doc
  comments. Load before writing or editing any of them.
---

# Docs writing

Write every sentence as if it had always existed, for a reader who saw none of the work that
produced it.

## Rules

1. **Final state only.** Present tense, current behavior of the tree being edited. No history
   ("previously", "now uses", "replaces"), no roadmap ("will land", "phase 2 adds"), no temporary
   state ("not wired yet", "until X lands"), and no issue references — tracking lives in the
   tracker, rationale lives in issues and PRs. A token that appears verbatim in code (a
   `baseline(#236)` disable marker) is a fact of the code, not a reference.
2. **No relational framing.** Never define a thing by its position among other things — "the
   second…", "another…", "alongside…", "unlike…", "also sanctioned". Each rule states its own scope
   in absolute terms and survives its neighbours being rewritten.
3. **The deletion test.** Cover the sentence; if a reader with the file open loses nothing, delete
   it. Restating a name, a signature, or a neighbouring sentence is a defect.
4. **Subject, not document.** Text points at the subject, never at the document or its structure
   ("as noted above", "this section covers", "see below") and never at the conversation or session
   that produced it. A file may state its scope in one line; it may not narrate its own structure.
5. **Succinct means selective.** Cut whole points that don't change what the reader does; write the
   survivors as complete sentences. Compression that costs a re-read saves nothing.
6. **Lead with the fact.** The answer first, framing never — "Reuses the existing bucket", not "What
   we want to do here is…".
7. **State the call.** A made decision never reads "may", "should", or "might" — hedged modals are
   for genuinely open options only.
8. **One rationale per decision.** Say why once. Restating the same justification in different words
   is a defect.
9. **Parentheses hold identifiers, paths, and values.** Never a gloss restating the prose, and at
   most one parenthetical per sentence.
10. **Bullets for parallel facts, prose for causal flow.** A paragraph enumerating parallel items is
    a list — break it. A list whose items narrate cause and effect is a paragraph — join it.
11. **Promote bold-leads.** A `**Topic.**` fronting a multi-paragraph block is a heading dodging the
    outline — promote it. One-line bold-leads are fine.
