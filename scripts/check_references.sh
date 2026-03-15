#!/bin/bash

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
    if [ -d "$SITE_DIR/$dir" ]; then
        # Use grep to find files containing the missing reference string
        FOUND=$(grep -rl "$SEARCH_STRING" "$SITE_DIR/$dir")
        if [ ! -z "$FOUND" ]; then
            MISSING_REFS="$MISSING_REFS$FOUND"$'\n'
        fi
    fi
done

if [ ! -z "$MISSING_REFS" ]; then
    echo "❌ Found missing references in the following files:"
    echo "$MISSING_REFS"
    echo "Please check your citation keys in the source files and ensure they match _bibliography/references.bib."
    exit 1
else
    echo "✅ No missing references found in ${TARGET_DIRS[*]}."
    exit 0
fi
