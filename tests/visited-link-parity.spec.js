// @ts-check
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
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

// Third-party source trees are excluded by repository-relative path rather
// than directory basename so an authored directory named `vendor` elsewhere
// remains covered by this ownership audit.
const EXCLUDED_SUBTREES = ['js/vendor'];

function isInExcludedSubtree(fullPath) {
  const relativePath = path.relative(ROOT, fullPath).split(path.sep).join('/');
  return EXCLUDED_SUBTREES.some((subtree) =>
    relativePath === subtree || relativePath.startsWith(subtree + '/'),
  );
}

// .scss files are intentionally omitted: their nesting + `//` line
// comments confuse a simple regex parser, and they are compiled to .css
// before reaching the browser. The compiled CSS pairs `:visited`
// correctly already (see `_sass/_base.scss` → `a, a:visited`).
const SOURCE_EXTENSIONS = new Set(['.css', '.html', '.md']);

/**
 * Project source is what the repository versions: tracked files plus new
 * files that are not ignored. Ignored local material (build output, private
 * notes, tool scratch directories) is never audited.
 *
 * @returns {string[]}
 */
function collectSourceFiles(root) {
  const listing = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'utf8',
  });
  return listing.split('\0').filter(Boolean)
    .filter((relativePath) =>
      SOURCE_EXTENSIONS.has(path.extname(relativePath).toLowerCase()) &&
      !EXCLUDED_FILES.has(relativePath) &&
      !relativePath.split('/').slice(0, -1).some((directory) => EXCLUDED_DIRS.has(directory)))
    .map((relativePath) => path.join(root, relativePath))
    // A tracked file may be deleted in the working tree before staging.
    .filter((fullPath) => !isInExcludedSubtree(fullPath) && fs.existsSync(fullPath));
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
const STATE_PSEUDO = '(?:hover|focus|active|focus-visible|focus-within)';
// A selector ending in an interactive state pseudo-class, written directly
// (`a:hover`, `:where(a):focus-visible`) or as the only arguments of
// :is()/:where() (`a:is(:hover, :focus)`).
const STATE_TAIL_RE = new RegExp(
  `(?::${STATE_PSEUDO}|:(?:is|where)\\(\\s*:${STATE_PSEUDO}(?:\\s*,\\s*:${STATE_PSEUDO})*\\s*\\))\\s*$`,
);
const COLOR_RE = /(^|[;{\s])color\s*:/;

/**
 * Split a selector list at its top-level commas; commas inside :is(),
 * :where(), or :not() arguments belong to a single selector.
 *
 * @param {string} selector
 */
function splitSelectorList(selector) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < selector.length; i++) {
    if (selector[i] === '(') depth++;
    else if (selector[i] === ')') depth--;
    else if (selector[i] === ',' && depth === 0) {
      parts.push(selector.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(selector.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

/**
 * Decide whether a rule is "interactive-state-only" — i.e. every selector in
 * the list ends in :hover / :focus / :active / :focus-visible /
 * :focus-within. Such rules apply on top of both :link and :visited, so they
 * do NOT need their own :visited companion.
 *
 * @param {string} selector
 */
function isStateOnlyRule(selector) {
  const parts = splitSelectorList(selector);
  return parts.length > 0 && parts.every((part) => STATE_TAIL_RE.test(part));
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
