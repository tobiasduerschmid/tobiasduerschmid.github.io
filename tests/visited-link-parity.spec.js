// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/**
 * Visited Link Parity
 *
 * Project rule: a:visited must be styled identically to the unvisited state
 * (a / a:link). The user-facing color must NOT shift after a link has been
 * clicked. The robust pattern is to pair `:visited` with the unvisited
 * selector in the same comma-separated rule:
 *
 *     .foo a,
 *     .foo a:visited { color: #2774AE; ... }
 *
 * This test scans every project CSS / SCSS / inline-style block and flags
 * any rule that sets `color` on an anchor selector without a `:visited`
 * companion in the same rule. State pseudo-classes (:hover, :focus,
 * :focus-visible, :active) are exempt because they apply on top of both
 * link and visited and inherit the base color.
 */

const ROOT = path.resolve(__dirname, '..');

const EXCLUDED_DIRS = new Set([
  '.git',
  '.claude',
  '.gemini',
  '.agents',
  '.jekyll-cache',
  '_site',
  'node_modules',
  'playwright-report',
  'test-results',
  'tmp',
  'pdfs',
  'img',
  'fonts',
  'files',
  'assets',
  'lit-search',
  'vm',
]);

// Vendored 3rd-party stylesheets we don't own — known to ship anchor rules
// without :visited companions. We deliberately do not edit these.
const EXCLUDED_FILES = new Set([
  'css/bootstrap.cmu.css',
  'css/bootstrap.ucla.css',
  'css/bootstrap-image-gallery.min.css',
  'css/hoverex-all.css',
  'css/unslider.css',
  'css/unslider-dots.css',
  'css/scrolling-nav.css',
]);

// .scss files are intentionally omitted: their nesting + `//` line
// comments confuse a simple regex parser, and they are compiled to .css
// before reaching the browser. The compiled CSS pairs `:visited`
// correctly already (see `_sass/_base.scss` → `a, a:visited`).
const SOURCE_EXTENSIONS = new Set(['.css', '.html', '.md']);

/** @returns {string[]} */
function collectSourceFiles(dir) {
  /** @type {string[]} */
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') && !['.gitignore'].includes(entry.name)) {
      // .git / .claude / .agents / etc. are excluded above; other dotfiles too.
      if (EXCLUDED_DIRS.has(entry.name)) continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      out.push(...collectSourceFiles(full));
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!SOURCE_EXTENSIONS.has(ext)) continue;
    const rel = path.relative(ROOT, full);
    if (EXCLUDED_FILES.has(rel)) continue;
    out.push(full);
  }
  return out;
}

/**
 * Extract CSS rule blocks from a chunk of source. For .css / .scss the
 * whole file is the source; for .html / .md we extract only `<style>...
 * </style>` blocks so that prose and code samples don't trigger false
 * positives.
 *
 * @param {string} content
 * @param {string} ext
 * @returns {string}
 */
function extractCss(content, ext) {
  if (ext === '.css' || ext === '.scss') return content;
  const styleBlocks = [];
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(content)) !== null) {
    styleBlocks.push(m[1]);
  }
  return styleBlocks.join('\n');
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Parse top-level rule blocks (selector { body }). This is intentionally
 * shallow — it does not handle nested SCSS at-rules deeply, which is
 * good enough because :visited issues live in the leaf rules anyway.
 *
 * @param {string} css
 * @returns {{ selector: string, body: string, index: number }[]}
 */
function findRules(css) {
  const rules = [];
  let depth = 0;
  let blockStart = -1;
  let selectorStart = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') {
      if (depth === 0) {
        blockStart = i;
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && blockStart !== -1) {
        const selector = css.slice(selectorStart, blockStart).trim();
        const body = css.slice(blockStart + 1, i);
        if (selector) rules.push({ selector, body, index: selectorStart });
        selectorStart = i + 1;
        blockStart = -1;
      }
    } else if (ch === ';' && depth === 0) {
      // Top-level @import / variable; skip to next.
      selectorStart = i + 1;
    }
  }
  return rules;
}

const ANCHOR_SELECTOR_RE =
  /(^|[\s>+~,()])a(?=[\s,.#:[{]|$)/;
const VISITED_RE = /:visited\b/;
// Matches any selector that ENDS in an interactive state pseudo —
// e.g. `a:hover`, `.foo a:focus`, `a.bar:active`, `:where(a):focus-visible`.
// State-only rules apply on top of both :link and :visited, so they
// inherit the base color from the unvisited+visited pair.
const STATE_PSEUDO_TAIL_RE =
  /:(?:hover|focus|active|focus-visible|focus-within)(?:\s*[,>+~]|\s*$)?/;
const COLOR_RE = /(^|[;{\s])color\s*:/;

/**
 * Decide whether a rule is "interactive-state-only" — i.e. every
 * comma-separated selector ends in :hover / :focus / :active /
 * :focus-visible / :focus-within. Such rules apply on top of both
 * :link and :visited, so they do NOT need their own :visited companion.
 *
 * @param {string} selector
 */
function isStateOnlyRule(selector) {
  const parts = selector.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return false;
  return parts.every((part) =>
    /:(?:hover|focus|active|focus-visible|focus-within)\b\s*$/.test(part),
  );
}

function selectorMentionsAnchor(selector) {
  return ANCHOR_SELECTOR_RE.test(selector);
}

test.describe('Visited Link Parity', () => {
  test('every anchor color rule pairs :visited with the unvisited selector', () => {
    const sourceFiles = collectSourceFiles(ROOT);
    /** @type {string[]} */
    const violations = [];

    for (const file of sourceFiles) {
      const ext = path.extname(file).toLowerCase();
      const content = fs.readFileSync(file, 'utf8');
      const css = stripComments(extractCss(content, ext));
      if (!css.trim()) continue;

      const rules = findRules(css);
      for (const { selector, body } of rules) {
        if (!selectorMentionsAnchor(selector)) continue;
        if (!COLOR_RE.test(body)) continue;
        if (VISITED_RE.test(selector)) continue;
        if (isStateOnlyRule(selector)) continue;

        const rel = path.relative(ROOT, file);
        const compactSelector = selector.replace(/\s+/g, ' ').trim();
        violations.push(
          `${rel}: anchor color rule missing :visited companion → ${compactSelector}`,
        );
      }
    }

    expect(
      violations,
      `Found ${violations.length} anchor color rule(s) without a :visited companion. ` +
        `Pair :visited with the unvisited selector in the same rule, e.g.\n` +
        `    .foo a, .foo a:visited { color: #2774AE; }\n\n` +
        violations.map((v) => '  • ' + v).join('\n'),
    ).toEqual([]);
  });
});
