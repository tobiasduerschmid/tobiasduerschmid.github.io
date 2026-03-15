install:
	bundle install
	npm install

build:
	bundle exec jekyll build --incremental

test:
	./scripts/check_references.sh
	npx playwright test

run:
	bundle exec jekyll serve --incremental

all: build test run