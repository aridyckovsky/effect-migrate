#!/bin/bash

# Parse labels.yml and create labels using gh CLI
# Requires: yq (https://github.com/mikefarah/yq)

if ! command -v yq &> /dev/null; then
    echo "❌ yq is not installed."
    echo ""
    echo "Install yq using one of the following methods:"
    echo "  macOS:   brew install yq"
    echo "  Linux:   snap install yq"
    echo "  Linux:   wget https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 -O /usr/local/bin/yq && chmod +x /usr/local/bin/yq"
    echo "  Windows: choco install yq"
    echo "  Or see: https://github.com/mikefarah/yq#install"
    exit 1
fi

LABELS_FILE=".github/labels.yml"

if [ ! -f "$LABELS_FILE" ]; then
    echo "❌ Labels file not found: $LABELS_FILE"
    exit 1
fi

# Read YAML and create labels
yq eval '.[] | "gh label create \"" + .name + "\" -c \"" + .color + "\" -d \"" + .description + "\" --force"' "$LABELS_FILE" | while read -r cmd; do
    eval "$cmd"
done

echo "✅ Labels synced successfully!"
