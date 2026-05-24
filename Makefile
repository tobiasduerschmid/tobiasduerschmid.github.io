.PHONY: init-submodules install build prod check test clean run run-hero-fast pdf latex all vm-setup vm-build vm-snapshot audit-a11y audit-a11y-interactive audit-a11y-tutorial audit-a11y-gym audit-a11y-quiz

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
	if [ "$$JEKYLL_ENV" = "production" ]; then node scripts/build_se_gym_hero_choice_previews.js; fi
	bundle exec jekyll build --incremental

prod:
	JEKYLL_ENV=production $(MAKE) run

check: build
	bash ./scripts/check_references.sh
	bash ./scripts/check_quizzes.sh


test: check
	npx playwright test

clean:
	rm -rf _site

run: check
	bundle exec jekyll serve --incremental --port $(JEKYLL_PORT)

run-hero-fast:
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

# --- Accessibility audits ---
#
# `audit-a11y` runs the URL-driven WCAG 2.2 AA sweep, the print-media sweep,
# and the source/static accessibility checks. The full URL + print sweeps are
# slow (30–90 min).
#
# `audit-a11y-interactive` adds the post-interaction sweep on top of the URL
# audit: the gym/quiz/tutorial behavior tests run with `A11Y_INTERACTIVE_CHECKS=1`,
# which makes them assert no axe violations at every state transition (gym
# activated, workout started, quiz answered, results shown, each tutorial
# step's pass / quiz gate / quiz-results screen).
#
# The targeted variants below run only one feature's interactive sweep, e.g.
# `make audit-a11y-tutorial TUTORIAL=git` runs the git tutorial's all-step
# spec with a11y assertions at every step and quiz. Useful when you suspect
# a regression in one area and don't want to wait for the full sweep.

audit-a11y:
	npx playwright test tests/wcag22-complete-audit.spec.js tests/wcag22-print-audit.spec.js tests/wcag22-source-implementation-sweep.spec.js tests/accessibility.spec.js
	@# Run with `WCAG_AUDIT_FULL_SWEEP=1 make audit-a11y` for the full URL sweep.

audit-a11y-interactive:
	A11Y_INTERACTIVE_CHECKS=1 npx playwright test \
	  tests/se-gym.spec.js tests/quiz.spec.js \
	  tests/git-tutorial.spec.js tests/git-advanced-tutorial.spec.js \
	  tests/python-tutorial.spec.js tests/java-tutorial.spec.js \
	  tests/c-tutorial.spec.js tests/nodejs-tutorial.spec.js \
	  tests/react-tutorial.spec.js tests/shell-tutorial.spec.js \
	  tests/sql-tutorial.spec.js tests/tdd-tutorial.spec.js \
	  tests/testing-foundations-tutorial.spec.js \
	  tests/playwright-tutorial.spec.js tests/prolog-tutorial.spec.js \
	  tests/makefile-tutorial.spec.js

# Targeted: full a11y sweep of one tutorial. Runs the all-step test with
# accessibility assertions at every step and every quiz.
#   make audit-a11y-tutorial TUTORIAL=git
#   make audit-a11y-tutorial TUTORIAL=python
TUTORIAL ?= git
audit-a11y-tutorial:
	A11Y_INTERACTIVE_CHECKS=1 \
	A11Y_INTERACTIVE_FEATURES=$(TUTORIAL)-tutorial \
	npx playwright test tests/$(TUTORIAL)-tutorial.spec.js

audit-a11y-gym:
	A11Y_INTERACTIVE_CHECKS=1 A11Y_INTERACTIVE_FEATURES=se-gym \
	npx playwright test tests/se-gym.spec.js

audit-a11y-quiz:
	A11Y_INTERACTIVE_CHECKS=1 A11Y_INTERACTIVE_FEATURES=quiz \
	npx playwright test tests/quiz.spec.js

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
