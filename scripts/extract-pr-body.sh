#!/usr/bin/env bash
# Extract PR body from draft markdown file, skipping YAML frontmatter and "# PR Draft:" line
# Usage: ./scripts/extract-pr-body.sh <draft-name.md>
#   If given just a filename, looks in docs/agents/prs/drafts/
#   Otherwise uses the full path provided

set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: $0 <draft-name.md>" >&2
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

# Skip YAML frontmatter (between --- lines) and "# PR Draft:" line
# Start output from "## What"
awk '
  BEGIN { in_frontmatter = 0; frontmatter_done = 0; }
  /^---$/ { 
    if (!frontmatter_done) {
      in_frontmatter = !in_frontmatter;
      if (!in_frontmatter) frontmatter_done = 1;
    }
    next;
  }
  frontmatter_done && /^# PR Draft:/ { next; }
  frontmatter_done && !in_frontmatter { print; }
' "$file"
