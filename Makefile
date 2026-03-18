install:
	bundle install
	npm install
	npx playwright install

build:
	bundle exec jekyll build --incremental

check: build
	./scripts/check_references.sh
	./scripts/check_quizzes.sh

test: check
	npx playwright test

clean:
	rm -rf _site

run: check
	bundle exec jekyll serve --incremental

pdf: build
	npm run pdf
	node scripts/merge_pdfs.js

all: test run