install:
	bundle install

all: 
	bundle exec jekyll serve --incremental

test:
	./scripts/check_references.sh