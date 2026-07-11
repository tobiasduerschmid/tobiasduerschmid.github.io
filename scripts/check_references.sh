#!/bin/bash

set -euo pipefail

# Configuration
SITE_DIR="_site"
SEARCH_STRING="(missing reference)"
# Focus on areas where citations are most common
TARGET_DIRS=("blog" "SEBook")

# Ensure site exists
if [ ! -d "$SITE_DIR" ]; then
    echo "Error: $SITE_DIR directory not found. Please build the site first (e.g., bundle exec jekyll build)."
    exit 1
fi

echo "🔍 Auditing $SITE_DIR for missing references..."

MISSING_REFS=""
for dir in "${TARGET_DIRS[@]}"; do
    target="$SITE_DIR/$dir"
    if [ ! -d "$target" ]; then
        echo "Error: expected built output directory $target was not found." >&2
        exit 1
    fi

    # grep exits 1 when there are no matches and >1 when the scan itself
    # failed. Only the former means the built output passed this check.
    if FOUND=$(grep -rl -- "$SEARCH_STRING" "$target"); then
        MISSING_REFS="$MISSING_REFS$FOUND"$'\n'
    else
        grep_status=$?
        if [ "$grep_status" -ne 1 ]; then
            echo "Error: could not scan $target for missing references." >&2
            exit "$grep_status"
        fi
    fi
done

if [ -n "$MISSING_REFS" ]; then
    echo "❌ Found missing references in the following files:"
    echo "$MISSING_REFS"
    echo "Please check your citation keys in the source files and ensure they match _bibliography/references.bib."
    exit 1
else
    echo "✅ No missing references found in ${TARGET_DIRS[*]}."
    exit 0
fi
