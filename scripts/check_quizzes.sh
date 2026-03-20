#!/bin/bash

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
    if [ -d "$SITE_DIR/$dir" ]; then
        # Use grep to find files containing the error string
        # Note: We exclude index.html in the root of target dirs if they are listings
        FOUND=$(grep -rl "$SEARCH_STRING" "$SITE_DIR/$dir")
        if [ ! -z "$FOUND" ]; then
            MISSING_QUIZZES="$MISSING_QUIZZES$FOUND"$'\n'
        fi
    fi
done

if [ ! -z "$MISSING_QUIZZES" ]; then
    echo "❌ Found missing quiz & flashcard data in the following files:"
    echo "$MISSING_QUIZZES"
    echo "Please check that the quiz/flashcard ID used in {% include quiz.html id='...' %} or {% include flashcards.html id='...' %} matches a file in _data/quizzes/ or _data/flashcards/."
    exit 1
else
    echo "✅ All included quizzes & flashcards have valid data in ${TARGET_DIRS[*]}."
    exit 0
fi
