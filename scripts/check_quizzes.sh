#!/bin/bash

set -euo pipefail

# Configuration
SITE_DIR="_site"
SEARCH_STRING="data not found for ID"
# Focus on areas where quizzes are most common
TARGET_DIRS=("blog" "SEBook")

# Ensure site exists
if [ ! -d "$SITE_DIR" ]; then
    echo "Error: $SITE_DIR directory not found. Please build the site first (e.g., bundle exec jekyll build)."
    exit 1
fi

echo "🔍 Auditing $SITE_DIR for missing quiz & flashcard data..."

MISSING_QUIZZES=""
for dir in "${TARGET_DIRS[@]}"; do
    target="$SITE_DIR/$dir"
    if [ ! -d "$target" ]; then
        echo "Error: expected built output directory $target was not found." >&2
        exit 1
    fi

    # grep exits 1 when there are no matches and >1 when the scan itself
    # failed. Only the former means the built output passed this check.
    if FOUND=$(grep -rl -- "$SEARCH_STRING" "$target"); then
        MISSING_QUIZZES="$MISSING_QUIZZES$FOUND"$'\n'
    else
        grep_status=$?
        if [ "$grep_status" -ne 1 ]; then
            echo "Error: could not scan $target for missing quiz and flashcard data." >&2
            exit "$grep_status"
        fi
    fi
done

if [ -n "$MISSING_QUIZZES" ]; then
    echo "❌ Found missing quiz & flashcard data in the following files:"
    echo "$MISSING_QUIZZES"
    echo "Please check that the quiz/flashcard ID used in {% include quiz.html id='...' %} or {% include flashcards.html id='...' %} matches a file in _data/quizzes/ or _data/flashcards/."
    exit 1
else
    echo "✅ All included quizzes & flashcards have valid data in ${TARGET_DIRS[*]}."
    exit 0
fi
