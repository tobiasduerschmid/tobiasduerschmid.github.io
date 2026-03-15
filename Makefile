install:
	bundle install

build:
	bundle exec jekyll build --incremental

test:
	./scripts/check_references.sh

run:
	bundle exec jekyll serve --incremental

all: build test run