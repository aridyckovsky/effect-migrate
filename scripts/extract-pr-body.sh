#!/usr/bin/env bash
# Extract PR body from draft markdown file, skipping YAML frontmatter and custom header line
# Usage: ./scripts/extract-pr-body.sh [OPTIONS] <draft-name.md>
#   If given just a filename, looks in docs/agents/prs/drafts/
#   Otherwise uses the full path provided
#
# Options:
#   -h, --header-pattern PATTERN  Custom header pattern to skip (default: "# PR Draft:")
#
# Examples:
#   ./scripts/extract-pr-body.sh test-preset-basic-async-arrow-detection.md
#   ./scripts/extract-pr-body.sh -h "# Draft:" my-pr-draft.md
#   ./scripts/extract-pr-body.sh --header-pattern "# PR:" docs/agents/prs/drafts/my-draft.md

set -euo pipefail

# Default header pattern
header_pattern="# PR Draft:"

# Parse options
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--header-pattern)
      if [ $# -lt 2 ]; then
        echo "Error: --header-pattern requires an argument" >&2
        exit 1
      fi
      header_pattern="$2"
      shift 2
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
  echo "  -h, --header-pattern PATTERN  Custom header pattern to skip (default: \"# PR Draft:\")" >&2
  echo "" >&2
  echo "Example: $0 test-preset-basic-async-arrow-detection.md" >&2
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

# Skip YAML frontmatter (between --- lines) and custom header line
# Start output from "## What"
# Note: Header pattern is used as a prefix match (e.g., "# PR Draft:" matches "# PR Draft: title")
awk -v header="$header_pattern" '
  BEGIN { in_frontmatter = 0; frontmatter_done = 0; }
  /^---$/ { 
    if (!frontmatter_done) {
      in_frontmatter = !in_frontmatter;
      if (!in_frontmatter) frontmatter_done = 1;
    }
    next;
  }
  frontmatter_done && (index($0, header) == 1) { next; }
  frontmatter_done && !in_frontmatter { print; }
' "$file"
