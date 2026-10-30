#!/usr/bin/env bash
# Checks each README against its line limit and each docs/ file against its cap, then runs
# check-prose.sh over the same files and every skill's Markdown. A README over its limit fails the
# run; a README over its target and a docs/ file over its cap print a warning and never fail it.
# When check-vision.sh sits beside it, it then runs that script, which checks docs/vision.md. When the
# repo has the skill-writing skill, it then runs that skill's check-skill.sh. It fails when either
# fails. Its last line counts the READMEs and those over their limit.
# Usage (from the repo root): check-length.sh
# A README's limit comes from its path alone: the root README and each packages/*/README.md take the
# front page and package limits, and every other README takes the folder limit. A spike README under
# docs/design/**/spikes/ is a folder README, not a doc. --package <readme> is deprecated: the script
# accepts it, prints a notice, and ignores it.
set -uo pipefail

usage() {
  echo "usage: check-length.sh" >&2
  exit 2
}

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

while [ "$#" -gt 0 ]; do
  case $1 in
    --package)
      [ "$#" -ge 2 ] || usage
      echo "check-length: --package is deprecated and ignored; a README's limit comes from its path" >&2
      shift 2
      ;;
    *) usage ;;
  esac
done

# Lists tracked and untracked files, so a new doc is checked before it is staged. A file deleted
# from the working tree stays in the index until the deletion is staged, so it is dropped here.
list_files() {
  git -c core.quotePath=false ls-files --cached --others --exclude-standard -- "$@" | sort -u | while IFS= read -r file; do
    [ -f "$file" ] && printf '%s\n' "$file"
  done
}

count_lines() {
  awk 'END { print NR }' "$1"
}

# Prints the README's target, limit and kind.
pick_readme_kind() {
  local readme=$1

  if [ "$readme" = README.md ]; then
    echo '80 100 front page'
  elif [[ $readme == packages/*/README.md && $readme != packages/*/*/README.md ]]; then
    echo '80 100 package'
  else
    echo '60 70 folder'
  fi
}

fail=0
readmes=0
over_limit=0
prose_paths=()
spike_readmes='docs/design/**/spikes/*/README.md'
spike_files='docs/design/**/spikes/**'

# docs/README.md is the docs index, so the docs cap governs it, not a README limit. A spike README
# under docs/design/ is a README.
while IFS= read -r readme; do
  prose_paths+=("$readme")
  readmes=$((readmes + 1))
  read -r target limit name <<< "$(pick_readme_kind "$readme")"
  lines=$(count_lines "$readme")

  if [ "$lines" -gt "$limit" ]; then
    fail=1
    over_limit=$((over_limit + 1))
    echo "$readme: $lines lines, over the $name README limit of $limit (target $target; error)"
  elif [ "$lines" -gt "$target" ]; then
    echo "$readme: $lines lines, over the $name README target of $target (limit $limit; warning)"
  else
    echo "$readme: $lines lines ($name README; target $target, limit $limit)"
  fi
done < <({
  list_files ':(glob)**/README.md' ':(exclude,glob)docs/**' ':(exclude,glob).claude/**'

  # git ls-files warns on a pathspec whose folder is missing.
  if [ -d docs/design ]; then
    list_files ":(glob)$spike_readmes"
  fi
} | sort)

# A spike's README takes a README limit, and its other files have no cap.
docs=$(list_files ':(glob)docs/**/*.md' ":(exclude,glob)$spike_files")

if [ -n "$(list_files ':(glob)docs/**/*.md')" ]; then
  prose_paths+=(':(glob)docs/**/*.md')
fi

while IFS= read -r doc; do
  [ -n "$doc" ] || continue
  cap=250
  case /$doc in */runbooks/*) cap=300 ;; esac
  lines=$(count_lines "$doc")

  if [ "$lines" -gt "$cap" ]; then
    echo "$doc: $lines lines, over the docs cap of $cap (warning: cut points, then split at a code boundary)"
  fi
done <<< "$docs"

# A spike keeps its full report in results.md beside its README, wherever the repo keeps its spikes.
if [ -n "$(list_files ':(glob)**/results.md')" ]; then
  prose_paths+=(':(glob)**/results.md')
fi

skills=$(list_files ':(glob).claude/skills/**/*.md' ':(glob)sync/skills/**/*.md')

if [ -n "$skills" ]; then
  prose_paths+=(':(glob).claude/skills/**/*.md' ':(glob)sync/skills/**/*.md')
fi

echo

if [ "${#prose_paths[@]}" -gt 0 ]; then
  bash "$script_dir/check-prose.sh" "${prose_paths[@]}" || fail=1
fi

# repo-sync delivers check-vision.sh only to a repo that takes the docs-vision-check entry.
if [ -f "$script_dir/check-vision.sh" ]; then
  echo
  bash "$script_dir/check-vision.sh" || fail=1
fi

for check_skill in .claude/skills/skill-writing/scripts/check-skill.sh \
  sync/skills/skill-writing/scripts/check-skill.sh; do
  if [ -f "$check_skill" ]; then
    echo
    bash "$check_skill" || fail=1
    break
  fi
done

echo
echo "check-length: $readmes READMEs, $over_limit over the line limit"
exit "$fail"
