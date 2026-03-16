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

run: check
	bundle exec jekyll serve --incremental

all: test run