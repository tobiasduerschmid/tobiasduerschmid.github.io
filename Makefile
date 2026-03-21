.PHONY: install build check test clean run pdf latex all vm-setup vm-build

install:
	bundle install
	npm install
	npx playwright install
	brew install cpdf # This needs to update for other OS
	pipenv install

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
	node scripts/merge_pdfs.js CS35L
	node scripts/merge_pdfs.js CS130
	node scripts/merge_pdfs.js 'SE Book'

clean-latex:
	cd latex && rm -f *.aux *.bbl *.blg *.log *.out *.toc main.pdf

latex:
	pipenv run python3 ./scripts/md_to_latex.py
	cd latex && pdflatex -interaction=nonstopmode main.tex && biber main && pdflatex -interaction=nonstopmode main.tex && pdflatex -interaction=nonstopmode main.tex

all: test run

# --- Tutorial VM ---
vm-setup:
	./vm/setup.sh

vm-build:
	./vm/build-rootfs.sh