#!/usr/bin/env bash
# Checks the structure of each skill; exits non-zero when a skill breaks a rule that fails the run.
# Usage (from the repo root): check-skill.sh [<skill-dir>...]
# With no argument it checks every directory holding a SKILL.md under .claude/skills/ and
# sync/skills/. A skill whose SKILL.md git marks linguist-vendored is skipped, so a repo marks its
# third-party skills in .gitattributes.
# Fails on: a missing name or description, a name that differs from the folder or breaks the name
# format, a description over 1,024 characters, a plain description that holds a colon YAML reads as a
# key, and a link with a line anchor outside code.
# Warns on: a SKILL.md over 500 lines, a reference that SKILL.md does not list under ## References,
# a reference over 100 lines with no contents list near its top, a reference that links to another
# reference, and a code-formatted span outside a table that names an existing repo file.
set -uo pipefail

# Lists tracked and untracked files, so a new skill is checked before it is staged.
list_files() {
  git -c core.quotePath=false ls-files --cached --others --exclude-standard -- "$@" | sort -u
}

is_vendored() {
  local value
  value=$(git check-attr linguist-vendored -- "$1/SKILL.md" | sed 's/^.*: //')
  [ "$value" = set ] || [ "$value" = true ]
}

dirs=()

if [ "$#" -gt 0 ]; then
  for dir in "$@"; do
    dir=${dir%/}
    if [ ! -f "$dir/SKILL.md" ]; then
      echo "check-skill: $dir has no SKILL.md" >&2
      exit 2
    fi
    dirs+=("$dir")
  done
else
  while IFS= read -r file; do
    [ -f "$file" ] && dirs+=("$(dirname "$file")")
  done < <(list_files ':(glob).claude/skills/**/SKILL.md' ':(glob)sync/skills/**/SKILL.md')
fi

checked=()

for dir in "${dirs[@]}"; do
  is_vendored "$dir" || checked+=("$dir")
done

if [ "${#checked[@]}" -eq 0 ]; then
  echo 'check-skill: no skills to check'
  exit 0
fi

perl -COE -e '
use strict;
use warnings;

my ($errors, $warnings) = (0, 0);

for my $dir (@ARGV) {
  $dir =~ s{^\./}{};
  check_skill($dir);
}

printf "check-skill: %d skills, %d errors, %d warnings\n", scalar @ARGV, $errors, $warnings;
exit($errors ? 1 : 0);

sub fail {
  my ($where, $message) = @_;
  print "$where: $message\n";
  $errors++;
}

sub warn_about {
  my ($where, $message) = @_;
  print "$where: $message (warning)\n";
  $warnings++;
}

sub to_bytes {
  my ($text) = @_;
  utf8::encode($text);
  return $text;
}

sub read_lines {
  my ($path) = @_;
  local $/ = "\n";
  open my $fh, "<:encoding(UTF-8)", to_bytes($path) or die "check-skill: cannot read $path: $!\n";
  my @lines = <$fh>;
  close $fh;
  chomp @lines;
  return @lines;
}

sub check_skill {
  my ($dir) = @_;
  my $skill = "$dir/SKILL.md";
  my @lines = read_lines($skill);

  warn_about($skill, scalar(@lines) . " lines, over 500; check that each section is one most tasks need")
    if @lines > 500;
  check_frontmatter($dir, $skill, @lines);

  open my $list, "-|", "git", "-c", "core.quotePath=false", "ls-files", "--cached", "--others",
    "--exclude-standard", "--", $dir, ":(exclude,attr:linguist-vendored)",
    ":(exclude,attr:linguist-vendored=true)" or die "check-skill: cannot list $dir: $!\n";
  my %files;
  while (my $file = <$list>) {
    chomp $file;
    utf8::decode($file);
    $files{$file} = 1 if $file =~ /\.md\z/ && -f to_bytes($file);
  }
  close $list;

  for my $file (sort keys %files) {
    check_markdown($dir, $file, $file eq $skill);
  }

  my %listed = map { $_ => 1 } list_references($skill, @lines);
  for my $file (sort grep { m{^\Q$dir\E/references/[^/]+\.md\z} } keys %files) {
    warn_about($file, "SKILL.md does not list it under ## References; add a line naming the task that needs it")
      unless $listed{$file};
  }
}

# Returns the files that the links under the ## References heading of SKILL.md point at.
sub list_references {
  my ($skill, @lines) = @_;
  my ($in_section, @found) = (0);
  for my $line (@lines) {
    if ($line =~ /^##\s+(.*?)\s*$/) {
      $in_section = $1 eq "References";
      next;
    }
    next unless $in_section;
    while ($line =~ /\]\(\s*([^()\s#]+)/g) {
      my $resolved = resolve_path($skill, $1);
      push @found, $resolved if defined $resolved;
    }
  }
  return @found;
}

# Reads the frontmatter block: a name, and a description that may fold over indented lines.
sub check_frontmatter {
  my ($dir, $skill, @lines) = @_;
  my ($name, $description, $in_description, $closed, $raw_description, $folded, $style, $colon);

  if (@lines && $lines[0] eq "---") {
    for my $line (@lines[1 .. $#lines]) {
      if ($line eq "---") { $closed = 1; last }
      if ($line =~ /^name:\s*(.*?)\s*$/) {
        $name = unquote($1);
        $in_description = 0;
      } elsif ($line =~ /^description:\s*(.*?)\s*$/) {
        $raw_description = $1;
        $style = pick_scalar_style($raw_description);
        $description = ($style // "") eq "block" ? "" : unquote($raw_description);
        $colon = 1 if ($style // "") eq "plain" && has_key_colon($description);
        $in_description = 1;
      } elsif ($in_description && $line =~ /^\s+(\S.*?)\s*$/) {
        $description .= ($description eq "" ? "" : " ") . $1;
        $style //= $1 =~ /\A["\x27]/ ? "quoted" : "plain";
        $colon = 1 if $style eq "plain" && has_key_colon($1);
        $folded = 1;
      } elsif ($line =~ /^[A-Za-z_-]+:/) {
        $in_description = 0;
      }
    }
  }

  # A plain null (null, Null, NULL or ~) on one line has no text, as YAML reads it.
  $description = "" if !$folded && defined $raw_description
    && $raw_description =~ /\A(?:null|Null|NULL|~)(?:\s+#.*)?\z/;

  unless ($closed) {
    fail($skill, "has no frontmatter block");
    return;
  }

  if (!defined $name || $name eq "") {
    fail($skill, "has no name");
  } else {
    my $folder = $dir =~ s{.*/}{}r;
    fail($skill, "name $name does not match the folder $folder") if $name ne $folder;
    fail($skill, "name $name is not lowercase letters, digits and hyphens of at most 64 characters")
      if $name !~ /\A[a-z0-9-]{1,64}\z/;
  }

  if (!defined $description || $description eq "") {
    fail($skill, "has no description");
  } elsif (length $description > 1024) {
    fail($skill, "description is " . length($description) . " characters, over the limit of 1024");
  }

  fail($skill, "description holds a colon and a space, which YAML reads as a key in a plain scalar; reword it, or quote it or write it as a block scalar (>-)")
    if $colon;
}

# Returns block, quoted or plain for the text after a key, or undef when the text is empty or only a
# comment, since the scalar then starts on the next line. A block header may hold an indentation
# digit and a chomping sign in either order, then a comment.
sub pick_scalar_style {
  my ($text) = @_;
  return undef if $text eq "" || $text =~ /\A#/;
  return "block" if $text =~ /\A[|>](?:[1-9][+-]?|[+-][1-9]?)?(?:\s+#.*)?\z/;
  return "quoted" if $text =~ /\A["\x27]/;
  return "plain";
}

# A colon followed by a space or the line end starts a mapping inside a plain YAML scalar, so a
# loader rejects the frontmatter. A space and a hash end the scalar and start a comment.
sub has_key_colon {
  my ($text) = @_;
  return ($text =~ s/\s+#.*\z//r) =~ /:(?:\s|\z)/;
}

# Returns the value of a scalar: the text inside its quotes, or plain text without a trailing comment.
sub unquote {
  my ($text) = @_;
  return $2 if $text =~ /\A(["\x27])(.*?)\1\s*(?:#.*)?\z/;
  return "" if $text =~ /\A#/;
  $text =~ s/\s+#.*\z//;
  return $text;
}

sub check_markdown {
  my ($dir, $file, $is_skill) = @_;
  my @lines = read_lines($file);
  my $open = "";
  my $line_number = 0;
  my $contents_links = 0;
  my $reference = !$is_skill;
  my $in_comment = 0;

  for my $line (@lines) {
    $line_number++;
    if ($line =~ /^\s*(`{3,}|~{3,})(.*)$/) {
      my ($marker, $rest) = ($1, $2);
      if ($open eq "") { $open = $marker }
      elsif (substr($marker, 0, 1) eq substr($open, 0, 1) && length($marker) >= length($open)
        && $rest =~ /^\s*$/) { $open = "" }
      next;
    }
    next if $open ne "";

    # An HTML comment never renders, so its text holds no link and no path.
    # A comment marker inside inline code renders as text, so the spans hide their markers first.
    my $visible = $line =~ s{(`+)(.+?)\1}{my $span = $&; $span =~ s/<!--/<\x{1}!--/g; $span =~ s/-->/--\x{1}>/g; $span}ger;
    if ($in_comment) {
      next unless $visible =~ s/\A.*?-->//;
      $in_comment = 0;
    }
    $visible =~ s/<!--.*?-->//g;
    $in_comment = 1 if $visible =~ s/<!--.*\z//;
    $visible =~ s/\x{1}//g;

    my $text = $visible;
    my @spans;
    $text =~ s/(`+)(.+?)\1/push @spans, $2; ""/ge;

    if ($line_number <= 30) {
      $contents_links++ while $text =~ /\]\(#[^)\s]+\)/g;
    }

    my @targets;
    push @targets, $1 while $text =~ /\]\(\s*(<[^>]*>|(?:[^()\s]|\([^()\s]*\))+)/g;
    push @targets, $1 if $text =~ /^\s{0,3}\[(?!\^)[^\]]+\]:\s*(<[^>]*>|\S+)/;
    push @targets, $2 while $text =~ /\b(?:href|src)\s*=\s*(["\x27])(.*?)\1/g;

    for my $target (@targets) {
      $target =~ s/^<(.*)>$/$1/;
      fail("$file:$line_number", "link $target has a line anchor; name the target in the link text instead")
        if $target =~ /#L[0-9]+/;
      check_reference_link($dir, $file, $line_number, $target) if $reference;
    }

    # A span inside link text is already a link, so only the spans left after links drop are read.
    # A table row holds commands the agent types, such as the commands table of a skill, so it is skipped.
    next if $visible =~ /^\s*\|/;
    my $outside_links = $visible =~ s/!?\[[^\]]*\]\([^)]*\)//gr;
    my @bare;
    $outside_links =~ s/(`+)(.+?)\1/push @bare, $2; ""/ge;

    for my $span (@bare) {
      $span =~ s/^\s+|\s+$//g;
      next if $span !~ m{\A[\w.@/-]+\z} || $span !~ m{[./]};
      warn_about("$file:$line_number", "`$span` names a file in the repo; link it instead")
        if -f to_bytes($span);
    }
  }

  if ($reference && @lines > 100 && $contents_links < 2) {
    warn_about($file, scalar(@lines) . " lines with no contents list near the top; open with links to its headings");
  }
}

sub check_reference_link {
  my ($dir, $file, $line_number, $target) = @_;
  return if $target eq "" || $target =~ m{^(?:[a-z][a-z0-9+.-]*:|//|#)}i;
  my ($path) = split /[#?]/, $target, 2;
  my $resolved = resolve_path($file, $path);
  return unless defined $resolved && $resolved ne $file;
  return unless $resolved =~ m{^\Q$dir\E/references/.*\.md\z};
  warn_about("$file:$line_number", "links to another reference ($resolved); link it from SKILL.md instead");
}

sub resolve_path {
  my ($file, $path) = @_;
  return undef if $path eq "";
  my @parts = $path =~ m{^/} ? () : split m{/}, $file;
  pop @parts unless $path =~ m{^/};
  for my $part (split m{/}, $path) {
    next if $part eq "" || $part eq ".";
    if ($part eq "..") {
      return undef unless @parts;
      pop @parts;
    } else {
      push @parts, $part;
    }
  }
  return @parts ? join("/", @parts) : undef;
}
' -- "${checked[@]}"
