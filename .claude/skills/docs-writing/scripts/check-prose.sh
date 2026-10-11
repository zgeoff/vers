#!/usr/bin/env bash
# Greps committed docs for prose violations; exits non-zero when any are found.
# Violation greps fail the run; candidate greps print for judgment and never fail it.
# Usage (from the repo root): check-prose.sh <path>...
# The awk programs are single-quoted on purpose: awk, not the shell, expands their fields.
# shellcheck disable=SC2016
set -uo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: check-prose.sh <path>..." >&2
  exit 2
fi

# The skill's own files, and the repo's project skill beside them, document the forbidden
# patterns and contain them as examples.
set -- "$@" ':(exclude).claude/skills/docs-writing' ':(exclude).claude/skills/project-docs-writing' \
  ':(exclude)sync/skills/docs-writing'

# Every grep reads untracked files too, so a new doc is checked before it is staged, and skips
# binary files.
grep_docs() {
  git grep --untracked -I "$@"
}

list_markdown() {
  git -c core.quotePath=false ls-files --cached --others --exclude-standard -- "$@" | grep '\.md$'
}

# Tracks fenced code blocks (backtick or tilde, any indent, closed by the same marker at least as
# long) so the checks below can tell fence lines and fenced content from prose.
fence_awk='
function fence_marker(line, m) {
  if (match(line, /^[ \t]*(```+|~~~+)/)) {
    m = substr(line, RSTART, RLENGTH)
    sub(/^[ \t]*/, "", m)
    return m
  }
  return ""
}
function fence_rest(line, m) {
  return substr(line, index(line, m) + length(m))
}
function closes(m, rest) {
  return substr(m, 1, 1) == substr(open, 1, 1) && length(m) >= length(open) && rest ~ /^[ \t]*$/
}
FNR == 1 { open = "" }
'

fail=0

report() {
  local label=$1 out=$2
  if [ -n "$out" ]; then
    fail=1
    printf '%s\n%s\n\n' "$label" "$out"
  fi
}

candidate() {
  local label=$1 out=$2
  if [ -n "$out" ]; then
    printf '%s\n%s\n\n' "$label" "$out"
  fi
}

report 'Process residue (date stamps, investigation framing, memory citations, §):' \
  "$(grep_docs -nP 'Verified 20[0-9]{2}-|Investigation count|\(see memory |\([0-9]{2,4}-[0-9]{2}-[0-9]{2}\)|^Mitigation:|§' -- "$@")"

# The words every zgeoff repo bans; a repo's AGENTS.md lists them with their legal senses.
# Judgment-only bans (bites, floor, anchor) are not grepped. CAS stays case-sensitive so "CAs"
# passes.
# AGENTS.md and the agents/ partials hold the banned-words registry itself, and "code fence" is the
# legal markdown sense of the word.
report 'Banned words:' \
  "$(grep_docs -nPi '\bsurfaces?\b|load-bearing|\bseams?\b|\bceilings?\b|(?<!code )\bfenc(e|es|ed|ing)\b|(?-i:\bCAS\b)|significantly|near-instant' -- "$@" ':(exclude)AGENTS.md' ':(exclude)agents')"

report 'Filler with no term-of-art use:' \
  "$(grep_docs -nPi 'organically|earns its complexity|cheap insurance|lays (the )?foundation|the right level' -- "$@")"

report 'Possessive on a markdown link:' \
  "$(grep_docs -nE "\]\([^)]*\)'s" -- "$@")"

report 'Role-label headings:' \
  "$(grep_docs -nE '^#{2,4} (Overview|Notes|Details|Rationale)$' -- "$@")"

report '"Should succeed" in a procedure — state the expected outcome instead:' \
  "$(grep_docs -nPi 'should (succeed|work|pass)\b' -- "$@")"

report 'Number joined to its unit ("64KB"; write "64 KB"; code blocks are exempt):' \
  "$(grep_docs -nP '\b[0-9]+(KB|MB|GB|TB|KiB|MiB|GiB|ms)\b' -- "$@" ':(exclude)*.md'
    list_markdown "$@" | xargs -r awk "$fence_awk"'
    {
      m = fence_marker($0)
      if (m != "") {
        rest = fence_rest($0, m)
        if (open == "") open = m
        else if (closes(m, rest)) open = ""
        next
      }
      if (open == "" && $0 ~ /(^|[^[:alnum:]_])[0-9]+(KB|MB|GB|TB|KiB|MiB|GiB|ms)([^[:alnum:]_]|$)/) print FILENAME":"FNR":"$0
    }')"

# Architecture docs state rules, never values. Code spans are dropped first, since a command the
# reader types may hold a value. A bare s, d or h joined to its number is no unit here ("1990s",
# "2d"); its spaced form is.
report 'Values with units under docs/architecture (the code owns its values; code blocks are exempt):' \
  "$(list_markdown "$@" | grep '^docs/architecture/' | xargs -r awk "$fence_awk"'
    {
      m = fence_marker($0)
      if (m != "") {
        rest = fence_rest($0, m)
        if (open == "") open = m
        else if (closes(m, rest)) open = ""
        next
      }
      if (open != "") next
      text = $0
      gsub(/`[^`]*`/, "", text)
      if (text ~ /(^|[^[:alnum:]_.])[0-9]+(\.[0-9]+)? ?(ms|min|KB|MB|GB|TB|KiB|MiB|GiB)([^[:alnum:]_]|$)/ ||
        text ~ /(^|[^[:alnum:]_.])[0-9]+(\.[0-9]+)? (s|h|d)([^[:alnum:]_]|$)/ ||
        text ~ /(^|[^[:alnum:]_.])[0-9]+[ -](second|minute|hour|day|week)s?([^[:alnum:]_]|$)/) print FILENAME":"FNR":"$0
    }')"

report 'Horizontal rules outside YAML frontmatter:' \
  "$(list_markdown "$@" | xargs -r awk \
    'FNR==1{fm=($0=="---")} fm&&FNR>1&&$0=="---"{fm=0;next} !fm&&$0=="---"{print FILENAME": "FNR}')"

report 'Untagged code fences:' \
  "$(list_markdown "$@" | xargs -r awk "$fence_awk"'
    {
      m = fence_marker($0)
      if (m == "") next
      rest = fence_rest($0, m)
      if (open == "") {
        open = m
        if (rest ~ /^[ \t]*$/) print FILENAME": "FNR
      } else if (closes(m, rest)) {
        open = ""
      }
    }')"

candidate 'Candidates — filler words with term-of-art uses; cull the filler, keep the terms:' \
  "$(grep_docs -nPi '\b(naturally|cleanly|trivially|easy|simple|quick)\b' -- "$@")"

candidate 'Candidates — speech verbs on data artifacts; the artifact holds, includes, returns, or matches:' \
  "$(grep_docs -nPi '(?<!file |table |column |export |bucket |method |variable |test )\b(names|says|tells|answers|knows|promises)\b(?! (rot|and locations|only))' -- "$@")"

candidate 'Candidates — delta-framing words; legal only when the baseline sits in the same doc:' \
  "$(grep_docs -nPi '(^|\. )(Also|Additionally|In addition),? |\b(already|today|before this work|as it does today)\b' -- "$@")"

candidate 'Candidates — headings written as claims; move the thesis into the first sentence:' \
  "$(grep_docs -nP '^#{2,4} (?!(What|Why|When|How|Before|Where|Which)\b).*\b(is|are|does|has|cannot|never|not)\b' -- "$@")"

if [ "$fail" -eq 0 ]; then
  echo 'check-prose: clean (candidates above, if any, need judgment only)'
fi

exit "$fail"
