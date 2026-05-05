// @ts-check
//
// Interactive-state accessibility checkpoints.
//
// Many features on this site only render their interesting UI after a user
// interacts: the personal gym needs activating, quizzes need answering, and
// tutorials only show step-success / quiz / results states after the learner
// drives them. The static `wcag22-complete-audit.spec.js` sweep loads pages
// in their default state and so cannot see those post-interaction screens.
//
// This helper plugs that gap. Existing behavior tests for those features
// already drive the UI through every state — when the interactive a11y flag
// is on, they additionally call `a11yCheckpoint(page, label)` at each state
// and the helper runs an axe pass + asserts no WCAG 2.2 AA violations.
//
// Default behavior: OFF. The checkpoint is a no-op and existing tests run
// at their normal speed.
//
// Enabling:
//   A11Y_INTERACTIVE_CHECKS=1   — turns checkpoints on for every spec.
//   WCAG_AUDIT_FULL_SWEEP=1     — also turns them on (CI runs both together).
//   A11Y_INTERACTIVE_FEATURES=git-tutorial,se-gym
//                                — restricts checkpoints to specific features
//                                  (any checkpoint that names another feature
//                                  becomes a no-op). Omit to enable everywhere.
//
// Targeted use:
//   A11Y_INTERACTIVE_CHECKS=1 npx playwright test tests/git-tutorial.spec.js
//                                — full a11y sweep of the git tutorial: every
//                                  step + every quiz gets an axe pass.
//
const { expect } = require('@playwright/test');

// Lazy-loaded so the helper imports cleanly even when the flag is off — keeps
// the default-off case fast and lets it run on machines that haven't installed
// dev deps yet.
let _AxeBuilder = null;
function getAxeBuilder() {
  if (_AxeBuilder) return _AxeBuilder;
  _AxeBuilder = require('@axe-core/playwright').default;
  return _AxeBuilder;
}

const FULL_SWEEP = process.env.WCAG_AUDIT_FULL_SWEEP === '1';
const FLAG = process.env.A11Y_INTERACTIVE_CHECKS === '1';
const FEATURE_FILTER = process.env.A11Y_INTERACTIVE_FEATURES
  ? new Set(
      process.env.A11Y_INTERACTIVE_FEATURES
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
  : null;

// axe rules the static audit handles via calibrated custom checks
// (see `wcag22-complete-audit.spec.js`). Disable here too so we don't
// double-report the same finding in interactive mode.
const AXE_RULES_HANDLED_LOCALLY = ['target-size', 'color-contrast', 'link-in-text-block'];
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Whether interactive a11y checkpoints should run for the given feature.
 * @param {string} [feature] feature name, e.g. "git-tutorial", "se-gym", "quiz"
 * @returns {boolean}
 */
function interactiveA11yEnabled(feature) {
  if (!FLAG && !FULL_SWEEP) return false;
  if (!FEATURE_FILTER) return true;
  return feature == null || FEATURE_FILTER.has(feature);
}

function formatViolations(label, violations) {
  if (!violations.length) return '';
  const lines = [`A11y violations at "${label}" (${violations.length}):`];
  for (const v of violations.slice(0, 10)) {
    lines.push(`  [${v.id}] (${v.impact || 'review'}) ${v.help}`);
    for (const node of (v.nodes || []).slice(0, 3)) {
      const target = Array.isArray(node.target) ? node.target.join(' ') : String(node.target || '');
      lines.push(`    - ${target}`);
    }
  }
  if (violations.length > 10) lines.push(`  …and ${violations.length - 10} more`);
  return lines.join('\n');
}

async function runAxe(page, { include, exclude, rules } = {}) {
  const AxeBuilder = getAxeBuilder();
  let builder = new AxeBuilder({ page });
  if (rules) {
    builder = builder.withRules(rules);
  } else {
    builder = builder.withTags(AXE_TAGS).disableRules(AXE_RULES_HANDLED_LOCALLY);
  }
  if (include) builder = builder.include(include);
  if (exclude) builder = builder.exclude(exclude);
  return builder.analyze();
}

/**
 * Run an axe-core scan against the current page state and assert no WCAG 2.2
 * AA violations. Cheap no-op when interactive checks are disabled.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} label human-readable state name (used in failure output)
 * @param {object} [opts]
 * @param {string} [opts.feature] feature key for `A11Y_INTERACTIVE_FEATURES`
 * @param {string|string[]} [opts.include] CSS selector(s) to scope the audit
 * @param {string|string[]} [opts.exclude] CSS selector(s) to exclude
 * @param {boolean} [opts.darkMode] also run a dark-mode pass that re-runs
 *        contrast-only rules — catches state-specific dark-mode contrast bugs
 *        that the static audit's default-state dark pass cannot see.
 */
async function a11yCheckpoint(page, label, opts = {}) {
  if (!interactiveA11yEnabled(opts.feature)) return;

  const lightResult = await runAxe(page, { include: opts.include, exclude: opts.exclude });
  const lightViolations = (lightResult.violations || []).filter(
    (v) => (v.tags || []).some((t) => AXE_TAGS.includes(t)),
  );
  expect(lightViolations, formatViolations(label, lightViolations)).toHaveLength(0);

  if (opts.darkMode) {
    const wasDark = await page.evaluate(
      () => document.documentElement.classList.contains('dark-mode'),
    );
    if (!wasDark) {
      await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
    }
    try {
      const darkResult = await runAxe(page, {
        include: opts.include,
        exclude: opts.exclude,
        rules: ['color-contrast'],
      });
      const darkViolations = darkResult.violations || [];
      expect(
        darkViolations,
        formatViolations(`${label} [dark mode]`, darkViolations),
      ).toHaveLength(0);
    } finally {
      if (!wasDark) {
        await page.evaluate(() => document.documentElement.classList.remove('dark-mode'));
      }
    }
  }
}

module.exports = {
  interactiveA11yEnabled,
  a11yCheckpoint,
};
