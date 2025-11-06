#!/usr/bin/env bash
# Extract PR body from draft markdown file, skipping YAML frontmatter and header line
# Usage: ./scripts/extract-pr-body.sh [OPTIONS] <draft-name.md>
#   If given just a filename, looks in docs/agents/prs/drafts/
#   Otherwise uses the full path provided
#
# Options:
#   --skip-header     Skip conventional commit header (# feat, # fix, etc.) - default behavior
#   --no-skip-header  Keep the header line in output
#
# Examples:
#   ./scripts/extract-pr-body.sh feat-core-version-registry.md
#   ./scripts/extract-pr-body.sh --no-skip-header my-pr-draft.md
#   ./scripts/extract-pr-body.sh docs/agents/prs/drafts/my-draft.md

set -euo pipefail

# Default: skip conventional commit headers (# feat, # fix, # docs, etc.)
skip_header=true

# Parse options
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-header)
      skip_header=true
      shift
      ;;
    --no-skip-header)
      skip_header=false
      shift
      ;;
    -*)
      echo "Error: Unknown option: $1" >&2
      echo "Usage: $0 [OPTIONS] <draft-name.md>" >&2
      exit 1
      ;;
    *)
      break
      ;;
  esac
done

# Check for input file argument
if [ $# -eq 0 ]; then
  echo "Usage: $0 [OPTIONS] <draft-name.md>" >&2
  echo "Options:" >&2
  echo "  --skip-header     Skip conventional commit header (default)" >&2
  echo "  --no-skip-header  Keep the header line in output" >&2
  echo "" >&2
  echo "Example: $0 feat-core-version-registry.md" >&2
  echo "  (looks in docs/agents/prs/drafts/)" >&2
  exit 1
fi

# If argument contains a path separator, use it as-is; otherwise prepend drafts directory
if [[ "$1" == *"/"* ]]; then
  file="$1"
else
  file="docs/agents/prs/drafts/$1"
fi

# Validate file exists
if [ ! -e "$file" ]; then
  echo "Error: File not found: $file" >&2
  exit 2
fi

# Validate it's a regular file
if [ ! -f "$file" ]; then
  echo "Error: Not a regular file: $file" >&2
  exit 2
fi

# Validate file is readable
if [ ! -r "$file" ]; then
  echo "Error: File not readable: $file" >&2
  exit 2
fi

# Skip YAML frontmatter (between --- lines) and optionally skip header line
# Header patterns: # feat, # fix, # docs, # chore, # test, # refactor, # ci, # PR Draft:
# Start output from "## What"
awk -v skip="$skip_header" -v file="$file" '
  BEGIN { 
    in_frontmatter = 0; 
    frontmatter_done = 0;
    first_content_line = "";
    header_found = 0;
  }
  /^---$/ { 
    if (!frontmatter_done) {
      in_frontmatter = !in_frontmatter;
      if (!in_frontmatter) frontmatter_done = 1;
    }
    next;
  }
  frontmatter_done && !in_frontmatter {
    # Check first non-empty line after frontmatter
    if (first_content_line == "" && NF > 0) {
      first_content_line = $0;
      # Validate it has a conventional commit header
      if (!/^# (feat|fix|docs|chore|test|refactor|ci|PR Draft)(\(|:| )/) {
        print "Error: PR draft missing conventional commit header" > "/dev/stderr"
        print "" > "/dev/stderr"
        print "First line after YAML frontmatter must be a conventional commit header:" > "/dev/stderr"
        print "  # feat(scope): description" > "/dev/stderr"
        print "  # fix(scope): description" > "/dev/stderr"
        print "  # docs: description" > "/dev/stderr"
        print "  # chore: description" > "/dev/stderr"
        print "" > "/dev/stderr"
        print "Found: " first_content_line > "/dev/stderr"
        print "In file: " file > "/dev/stderr"
        print "" > "/dev/stderr"
        print "See docs/agents/AGENTS.md for PR draft requirements." > "/dev/stderr"
        exit 3
      }
      header_found = 1;
      # Skip this header line if skip=true
      if (skip == "true") {
        next;
      }
    }
    print; 
  }
  END {
    if (first_content_line == "" && frontmatter_done) {
      print "Error: PR draft has no content after YAML frontmatter" > "/dev/stderr"
      print "In file: " file > "/dev/stderr"
      exit 4
    }
  }
' "$file"
