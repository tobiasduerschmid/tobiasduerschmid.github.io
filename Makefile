install:
	bundle install
	npm install
	npx playwright install

build:
	bundle exec jekyll build --incremental

check: build
	./scripts/check_references.sh
	
test: check
	npx playwright test

run: check
	bundle exec jekyll serve --incremental

all: build test run