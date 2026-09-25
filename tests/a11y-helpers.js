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

function equalRatioContrastFindings(result) {
  return (result.incomplete || [])
    .filter((rule) => rule.id === 'color-contrast')
    .flatMap((rule) => (rule.nodes || []).filter((node) => {
      const checks = [...(node.any || []), ...(node.all || [])];
      return checks.some((check) => {
        const data = check.data || {};
        return data.messageKey === 'equalRatio'
          && Number(data.contrastRatio) < parseFloat(data.expectedContrastRatio);
      });
    }).map((node) => ({
      id: 'color-contrast',
      help: node.failureSummary || rule.help,
      impact: 'serious',
      nodes: [node],
    })));
}

async function unmarkedTextLinkFindings(page, { include, exclude } = {}) {
  const links = await page.evaluate(({ include, exclude }) => {
    const scoped = (value) => (Array.isArray(value) ? value : value ? [value] : []);
    const includes = scoped(include);
    const excludes = scoped(exclude);
    const contexts = 'p, li, blockquote, dd, td, th, figcaption, summary';
    const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
    const selectorFor = (element) => {
      const parts = [];
      for (let node = element; node; node = node.parentElement) {
        let position = 1;
        for (let previous = node.previousElementSibling; previous; previous = previous.previousElementSibling) {
          if (previous.tagName === node.tagName) position++;
        }
        parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${position})`);
      }
      return parts.join(' > ');
    };
    const luminance = (color) => {
      const channels = color.match(/[\d.]+/g);
      if (!channels || channels.length < 3) return null;
      const linear = channels.slice(0, 3).map((part) => {
        const value = Number(part) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    };
    const result = [];
    document.querySelectorAll(`${contexts.split(',').map((item) => `${item.trim()} a[href]`).join(',')}`)
      .forEach((link) => {
        if (includes.length && !includes.some((selector) => link.matches(selector) || link.closest(selector))) return;
        if (excludes.some((selector) => link.matches(selector) || link.closest(selector))) return;
        if (!link.getClientRects().length || getComputedStyle(link).visibility === 'hidden') return;
        if (link.closest('nav, header, footer, [role="navigation"]')) return;
        const parent = link.parentElement;
        if (!parent || normalize(parent.textContent) === normalize(link.textContent)) return;
        const style = getComputedStyle(link);
        const parentStyle = getComputedStyle(parent);
        const decorated = (style.textDecorationLine || '').includes('underline')
          && !(parentStyle.textDecorationLine || '').includes('underline');
        const bordered = parseFloat(style.borderBottomWidth || '0') > 0
          && style.borderBottomStyle !== 'none';
        const weightDiff = Math.abs((Number(style.fontWeight) || 400)
          - (Number(parentStyle.fontWeight) || 400)) >= 200;
        const italicDiff = style.fontStyle !== parentStyle.fontStyle;
        const backgroundDiff = style.backgroundColor !== parentStyle.backgroundColor
          && !['transparent', 'rgba(0, 0, 0, 0)'].includes(style.backgroundColor);
        if (link.querySelector('img, svg, picture, [class*="icon"]')) return;
        const active = link.matches(':hover, :focus, :focus-visible');
        const outlined = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 1;
        if (decorated || bordered || weightDiff || italicDiff || backgroundDiff || outlined) return;
        const linkLum = luminance(style.color);
        const textLum = luminance(parentStyle.color);
        if (linkLum == null || textLum == null) return;
        const ratio = (Math.max(linkLum, textLum) + 0.05)
          / (Math.min(linkLum, textLum) + 0.05);
        result.push({
          target: link.outerHTML.slice(0, 200),
          selector: selectorFor(link),
          ratio,
          active,
        });
      });
    return result;
  }, { include, exclude });
  const finding = (target, help) => ({
    id: 'link-in-text-block', help, impact: 'serious', nodes: [{ target: [target] }],
  });
  const findings = links.filter((link) => link.ratio < 3 && !link.active)
    .map((link) => finding(link.target, 'In-text link has no non-color distinction from surrounding text'));
  const candidates = links.filter((link) => link.ratio >= 3 && !link.active);
  // An already-hovered or focused link cannot reveal its default CSS state
  // without disturbing the interaction. Report that audit gap separately,
  // rather than treating a compliant active link as a WCAG failure.
  const activeToReview = links.filter((link) => link.active);
  if (activeToReview.length) {
    console.warn('Manual review: default link cues are unverified while these in-text links are active:',
      activeToReview.map((link) => link.target));
  }
  if (!candidates.length) return findings;

  // G183 permits a color-only default link when its text differs by at least
  // 3:1 from surrounding text AND hover and keyboard focus add a non-color cue.
  // Force CSS pseudo-states without moving the pointer, focus, or scroll.
  const client = await page.context().newCDPSession(page);
  let forcedNodeId = null;
  const styleFor = (selector) => page.evaluate((target) => {
    const element = document.querySelector(target);
    const style = getComputedStyle(element);
    return {
      decoration: style.textDecorationLine,
      outlineStyle: style.outlineStyle,
      outlineWidth: parseFloat(style.outlineWidth),
      borderStyle: style.borderBottomStyle,
      borderWidth: parseFloat(style.borderBottomWidth),
      weight: Number(style.fontWeight) || 400,
      fontStyle: style.fontStyle,
      boxShadow: style.boxShadow,
      before: getComputedStyle(element, '::before').content,
      after: getComputedStyle(element, '::after').content,
    };
  }, selector);
  const hasCue = (base, state) => {
    const decorated = (value) => /\b(underline|overline)\b/.test(value);
    const visibleEdge = (kind, width) => kind !== 'none' && kind !== 'hidden' && width >= 1;
    const content = (value) => value && value !== 'none' && value !== 'normal' && value !== '""';
    return (decorated(state.decoration) && !decorated(base.decoration))
      || (visibleEdge(state.outlineStyle, state.outlineWidth)
        && !visibleEdge(base.outlineStyle, base.outlineWidth))
      || (visibleEdge(state.borderStyle, state.borderWidth)
        && !visibleEdge(base.borderStyle, base.borderWidth))
      || state.weight >= base.weight + 200
      || (state.fontStyle !== base.fontStyle && state.fontStyle !== 'normal')
      || (state.boxShadow !== 'none' && base.boxShadow === 'none')
      || (content(state.before) && state.before !== base.before)
      || (content(state.after) && state.after !== base.after);
  };
  try {
    await client.send('DOM.enable');
    await client.send('CSS.enable');
    const { root } = await client.send('DOM.getDocument');
    for (const link of candidates) {
      const { nodeId } = await client.send('DOM.querySelector', {
        nodeId: root.nodeId, selector: link.selector,
      });
      if (!nodeId) {
        findings.push(finding(link.target, 'Manual review: in-text link changed during hover/focus cue audit'));
        continue;
      }
      const base = await styleFor(link.selector);
      const missing = [];
      for (const [name, forcedPseudoClasses] of [
        ['hover', ['hover']],
        ['keyboard focus', ['focus', 'focus-visible']],
      ]) {
        forcedNodeId = nodeId;
        await client.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses });
        if (!hasCue(base, await styleFor(link.selector))) missing.push(name);
      }
      await client.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
      forcedNodeId = null;
      if (missing.length) {
        findings.push(finding(link.target, `Color-distinguished in-text link lacks a non-color cue on ${missing.join(' and ')}`));
      }
    }
  } finally {
    if (forcedNodeId) {
      await client.send('CSS.forcePseudoState', {
        nodeId: forcedNodeId, forcedPseudoClasses: [],
      }).catch(() => {});
    }
    await client.detach();
  }
  return findings;
}

async function runAxe(page, { include, exclude, rules } = {}) {
  const AxeBuilder = getAxeBuilder();
  let builder = new AxeBuilder({ page });
  if (rules) {
    builder = builder.withRules(rules);
  } else {
    // The static audit's calibrated checks only see the initial page state.
    // Keep these axe rules active here so dynamic controls and feedback are
    // checked after each interaction, including target size and contrast.
    builder = builder.withTags(AXE_TAGS);
  }
  if (include) builder = builder.include(include);
  if (exclude) builder = builder.exclude(exclude);
  return builder.analyze();
}

async function settlePaint(page) {
  if (page.isClosed()) return;
  await page.evaluate(
    () => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }),
  );
}

// Dark-mode checkpoints flip the site theme class inside an already-rendered
// interaction state. Several widgets animate background/color changes, and axe
// can otherwise sample a mid-transition color pair that no user-facing stable
// state has. Disable motion only while the synthetic theme flip is audited.
async function installMotionGuard(page) {
  return page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        scroll-behavior: auto !important;
      }
    `,
  });
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
 * @param {boolean} [opts.darkMode] run a dark-mode contrast pass (default true);
 *        set false only for views that are intentionally light-only, such as print.
 */
async function a11yCheckpoint(page, label, opts = {}) {
  if (!interactiveA11yEnabled(opts.feature)) return;
  return auditInteractiveState(page, label, opts);
}

// Exported separately so the audit contract can be tested without depending
// on the optional environment flag used by the large behavior suites.
async function auditInteractiveState(page, label, opts = {}) {
  const lightResult = await runAxe(page, { include: opts.include, exclude: opts.exclude });
  const lightViolations = (lightResult.violations || []).filter(
    (v) => (v.tags || []).some((t) => AXE_TAGS.includes(t)),
  ).concat(equalRatioContrastFindings(lightResult))
    .concat(await unmarkedTextLinkFindings(page, opts));
  expect(lightViolations, formatViolations(label, lightViolations)).toHaveLength(0);

  if (opts.darkMode !== false) {
    const wasDark = await page.evaluate(
      () => document.documentElement.classList.contains('dark-mode'),
    );
    const motionGuard = await installMotionGuard(page);
    try {
      if (!wasDark) {
        await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
      }
      await settlePaint(page);
      const darkResult = await runAxe(page, {
        include: opts.include,
        exclude: opts.exclude,
        rules: ['color-contrast'],
      });
      const darkViolations = (darkResult.violations || [])
        .concat(equalRatioContrastFindings(darkResult))
        .concat(await unmarkedTextLinkFindings(page, opts));
      expect(
        darkViolations,
        formatViolations(`${label} [dark mode]`, darkViolations),
      ).toHaveLength(0);
    } finally {
      if (!wasDark) {
        await page.evaluate(() => document.documentElement.classList.remove('dark-mode')).catch(() => {});
        await settlePaint(page).catch(() => {});
      }
      await motionGuard.evaluate((node) => node.remove()).catch(() => {});
    }
  }
}

module.exports = {
  interactiveA11yEnabled,
  a11yCheckpoint,
  auditInteractiveState,
};
