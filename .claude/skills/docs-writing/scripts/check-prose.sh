#!/usr/bin/env bash
# Greps committed docs for prose violations; exits non-zero when any are found.
# Usage (from the repo root): check-prose.sh <path>...
set -uo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: check-prose.sh <path>..." >&2
  exit 2
fi

# The skill's own files document the forbidden patterns and contain them as examples.
set -- "$@" ':(exclude).claude/skills/docs-writing'

fail=0

report() {
  local label=$1 out=$2
  if [ -n "$out" ]; then
    fail=1
    printf '%s\n%s\n\n' "$label" "$out"
  fi
}

report 'Process residue (date stamps, investigation framing, memory citations, §):' \
  "$(git grep -nP 'Verified 20[0-9]{2}-|Investigation count|\(see memory |\([0-9]{2,4}-[0-9]{2}-[0-9]{2}\)|^Mitigation:|§' -- "$@")"

# AGENTS.md owns the banned-words list; keep this pattern in sync. Judgment-only bans
# (bites, ceiling, floor) are not grepped. CAS stays case-sensitive so "CAs" passes.
report 'Banned words (judge each match — the AGENTS.md registry and markdown-fence senses are legal):' \
  "$(git grep -nPi '\bsurfaces?\b|load-bearing|\bseams?\b|\bfenc(e|es|ed|ing)\b|(?-i:\bCAS\b)' -- "$@")"

report 'Untagged code fences:' \
  "$(git ls-files -- "$@" | grep '\.md$' | xargs -r awk \
    'FNR==1{n=0} /^```/{n++; if (n%2==1 && $0=="```") print FILENAME": "FNR}')"

if [ "$fail" -eq 0 ]; then
  echo 'check-prose: clean'
fi

exit "$fail"
