#!/usr/bin/env bash
# Checks that the project-code-style skill lists the same verbs and exempt names as the
# zgeoff/function-verb rule in .oxlintrc.json; exits non-zero when they differ.
# Usage (from the repo root): check-project-verbs.sh [<skill> [<lint-config>]]
# The skill defaults to .claude/skills/project-code-style/SKILL.md and the config to .oxlintrc.json.
# A repo with no lint config passes, and a missing skill counts as one that lists no names. The skill lists each verb as a bullet or a table row that starts
# with the backticked verb under its "## Project verbs" heading, and each exempt name the same way
# under "## Exempt names".
set -uo pipefail

skill=${1:-.claude/skills/project-code-style/SKILL.md}
config=${2:-.oxlintrc.json}

if [ ! -f "$config" ]; then
  echo "check-project-verbs: no $config, so no project verbs to check"
  exit 0
fi

perl -MJSON::PP -e '
use strict;
use warnings;

my ($skill, $config) = @ARGV;

my %listed = (verbs => {}, exemptNames => {});
my %heading = ("Project verbs" => "verbs", "Exempt names" => "exemptNames");
my $section;
my $md;
open $md, "<", $skill or undef $md if -e $skill;
while (defined $md and my $line = <$md>) {
  if ($line =~ /^##\s+(.*?)\s*$/) {
    $section = $heading{$1};
    next;
  }
  next unless defined $section;
  $listed{$section}{$1} = 1 if $line =~ /^(?:-|\|)\s*`([^`]+)`/;
}
close $md if defined $md;

open my $fh, "<", $config or die "check-project-verbs: cannot read $config: $!\n";
my $text = do { local $/; <$fh> };
close $fh;
# Drops comments outside strings, since the lint config is JSON with comments.
$text =~ s{("(?:\\.|[^"\\])*")|//[^\n]*|/\*.*?\*/}{defined $1 ? $1 : ""}gse;
my $lint = JSON::PP->new->relaxed->decode($text);
my $rule = $lint->{rules}{"zgeoff/function-verb"};
my $options = ref $rule eq "ARRAY" && ref $rule->[1] eq "HASH" ? $rule->[1] : {};

my $differ = 0;
for my $key ("verbs", "exemptNames") {
  my %configured = map { $_ => 1 } @{ $options->{$key} // [] };
  for my $name (sort keys %configured) {
    next if $listed{$key}{$name};
    print "$skill: lacks `$name`, which $config lists in $key\n";
    $differ++;
  }
  for my $name (sort keys %{ $listed{$key} }) {
    next if $configured{$name};
    print "$skill: lists `$name`, which $config lacks in $key\n";
    $differ++;
  }
}

if ($differ) {
  exit 1;
}
print "check-project-verbs: the skill and $config list the same verbs and exempt names\n";
' "$skill" "$config"
