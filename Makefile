.PHONY: init-submodules install build check test clean run pdf latex all vm-setup vm-build vm-snapshot

JEKYLL_PORT ?= $(shell ruby -e 'require "socket"; port = 4000; loop do; begin; TCPServer.new("127.0.0.1", port).close; puts port; break; rescue Errno::EADDRINUSE; port += 1; rescue Errno::EACCES, Errno::EPERM; puts port; break; end; end')

init-submodules:
	git submodule sync --recursive
	git submodule update --init --recursive

install: init-submodules
	bundle install
	npm install
	npx playwright install
	brew install cpdf # This needs to update for other OS
	pipenv install

build:
	bundle exec jekyll build --incremental

check: build
	bash ./scripts/check_references.sh
	bash ./scripts/check_quizzes.sh


test: check
	npx playwright test

clean:
	rm -rf _site

run: check
	bundle exec jekyll serve --incremental --port $(JEKYLL_PORT)

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

# Boot the VM in headless Chromium and dump a post-boot snapshot to
# vm/dist/state.bin. Drops the in-page boot from ~30s to ~2s. Requires
# `make run` in another terminal (Playwright drives the live Jekyll site).
# JEKYLL_PORT here defaults to 4000 — the auto-detect logic above picks a
# *free* port, but vm-snapshot needs to target the *running* Jekyll instance.
SNAPSHOT_PORT ?= 4000
vm-snapshot:
	JEKYLL_PORT=$(SNAPSHOT_PORT) node vm/build-snapshot.js
