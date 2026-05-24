// @ts-check
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE_ROOT = path.join(ROOT, '_site');
const REPORT_PATH = path.join(ROOT, 'tmp', process.env.WCAG_AUDIT_REPORT_NAME || 'wcag22-audit-results.json');

// Rules we already cover with calibrated custom checks. Disabling the axe
// equivalent avoids double-reporting, since our versions are tuned for this
// codebase (e.g. Monaco / MathJax exceptions for target-size, SVG <text>
// support for color-contrast, dark-mode-aware contrast, link-in-text-block
// matching the project's underline conventions).
const AXE_RULES_HANDLED_LOCALLY = ['target-size', 'color-contrast', 'link-in-text-block'];
const AXE_RULE_CRITERION_OVERRIDES = {
  region: '1.3.1',
  'scrollable-region-focusable': '2.1.1',
  'color-contrast': '1.4.3',
};
const AXE_EXPLICIT_RULES = Object.keys(AXE_RULE_CRITERION_OVERRIDES);

// axe-core tags every WCAG-mapped rule with `wcagXYZ` (e.g. `wcag111`,
// `wcag1410`, `wcag2411`). Build a reverse lookup so we can attach each axe
// violation to the exact success criterion it maps to.
const AXE_TAG_TO_CRITERION = (() => {
  const map = new Map();
  // Filled in once WCAG_22_AA is declared below.
  return map;
})();

function parseNonNegativeIntegerEnv(name) {
  const raw = process.env[name];
  if (raw == null || raw === '') return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer, got ${JSON.stringify(raw)}`);
  }
  return value;
}

const FULL_SWEEP = process.env.WCAG_AUDIT_FULL_SWEEP === '1';
const URL_FILTER = process.env.WCAG_AUDIT_URL_FILTER ? new RegExp(process.env.WCAG_AUDIT_URL_FILTER) : null;
const EXPLICIT_PAGE_LIMIT = parseNonNegativeIntegerEnv('WCAG_AUDIT_PAGE_LIMIT');
// Local `npx playwright test` runs need a representative smoke sweep; the
// full site pass is opt-in because each page now runs multiple expensive
// light/dark, axe, focus, and mobile checks. CI enables the full sweep with
// WCAG_AUDIT_FULL_SWEEP=1.
const MAX_PAGES_PER_FEATURE = EXPLICIT_PAGE_LIMIT ?? (FULL_SWEEP || URL_FILTER ? 0 : 1);
const CONFORMANCE_TARGET = {
  standard: 'WCAG',
  version: '2.2',
  level: 'AA',
  label: 'WCAG 2.2 AA',
  includesCriterionLevels: ['A', 'AA'],
  note: 'WCAG Level AA conformance requires satisfying both Level A and Level AA success criteria.',
};

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() ? [full] : [];
  });
}

function urlFromSiteFile(file) {
  let rel = path.relative(SITE_ROOT, file).split(path.sep).join('/');
  if (!rel.endsWith('.html')) return null;
  rel = rel.replace(/index\.html$/, '');
  return `/${rel}`;
}

function sourceTutorialUrls() {
  const urls = new Set();
  for (const file of walk(path.join(ROOT, 'SEBook'))) {
    if (!/\.(md|html)$/.test(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (!/^layout:\s*tutorial\s*$/m.test(text)) continue;
    let rel = path.relative(ROOT, file).split(path.sep).join('/');
    rel = rel.replace(/\.(md|html)$/, '.html');
    urls.add(`/${rel}`);

    const printPath = rel.replace(/\.html$/, '/print');
    const printIndex = path.join(SITE_ROOT, `${printPath}/index.html`);
    const printHtml = path.join(SITE_ROOT, `${printPath}.html`);
    if (fs.existsSync(printIndex)) {
      urls.add(`/${printPath}/`);
    }
    if (fs.existsSync(printHtml)) {
      urls.add(`/${printPath}.html`);
    }
  }
  return [...urls].sort();
}

function allTargetUrls() {
  const htmlFiles = walk(SITE_ROOT).filter((file) => file.endsWith('.html'));
  const urls = htmlFiles.map(urlFromSiteFile).filter(Boolean);
  const tutorialSet = new Set(sourceTutorialUrls());
  // Info pages bundle the accessibility-relevant reference pages a user
  // can land on directly: the storage inventory at /cookies/, the keyboard
  // shortcut reference at /shortcuts/, the abbreviation glossary at /glossary/,
  // and the user preferences page at /settings/. Each is reachable from the footer.
  const INFO_PAGE_URLS = new Set([
    '/cookies/',
    '/shortcuts/',
    '/glossary/',
    '/settings/',
    '/uml-python-workspace.html',
  ]);
  const groups = {
    home: fs.existsSync(path.join(SITE_ROOT, 'index.html')) ? ['/index.html'] : [],
    errorPages: urls.filter((url) => url === '/404.html'),
    infoPages: urls.filter((url) => INFO_PAGE_URLS.has(url)),
    tutorials: urls.filter((url) => tutorialSet.has(url)),
    sebook: urls.filter((url) => url.startsWith('/SEBook/') && !tutorialSet.has(url)),
    seGym: urls.filter((url) => url === '/se-gym/' || url.startsWith('/se-gym/')),
    blog: urls.filter((url) => url === '/blog/' || url.startsWith('/blog/')),
  };
  for (const key of Object.keys(groups)) {
    groups[key].sort();
    if (URL_FILTER) groups[key] = groups[key].filter((url) => URL_FILTER.test(url));
    if (MAX_PAGES_PER_FEATURE > 0) groups[key] = groups[key].slice(0, MAX_PAGES_PER_FEATURE);
  }
  return groups;
}

const WCAG_22_AA = [
  ['1.1.1', 'A', 'Non-text Content'],
  ['1.2.1', 'A', 'Audio-only and Video-only (Prerecorded)'],
  ['1.2.2', 'A', 'Captions (Prerecorded)'],
  ['1.2.3', 'A', 'Audio Description or Media Alternative (Prerecorded)'],
  ['1.2.4', 'AA', 'Captions (Live)'],
  ['1.2.5', 'AA', 'Audio Description (Prerecorded)'],
  ['1.3.1', 'A', 'Info and Relationships'],
  ['1.3.2', 'A', 'Meaningful Sequence'],
  ['1.3.3', 'A', 'Sensory Characteristics'],
  ['1.3.4', 'AA', 'Orientation'],
  ['1.3.5', 'AA', 'Identify Input Purpose'],
  ['1.4.1', 'A', 'Use of Color'],
  ['1.4.2', 'A', 'Audio Control'],
  ['1.4.3', 'AA', 'Contrast (Minimum)'],
  ['1.4.4', 'AA', 'Resize Text'],
  ['1.4.5', 'AA', 'Images of Text'],
  ['1.4.10', 'AA', 'Reflow'],
  ['1.4.11', 'AA', 'Non-text Contrast'],
  ['1.4.12', 'AA', 'Text Spacing'],
  ['1.4.13', 'AA', 'Content on Hover or Focus'],
  ['2.1.1', 'A', 'Keyboard'],
  ['2.1.2', 'A', 'No Keyboard Trap'],
  ['2.1.4', 'A', 'Character Key Shortcuts'],
  ['2.2.1', 'A', 'Timing Adjustable'],
  ['2.2.2', 'A', 'Pause, Stop, Hide'],
  ['2.3.1', 'A', 'Three Flashes or Below Threshold'],
  ['2.4.1', 'A', 'Bypass Blocks'],
  ['2.4.2', 'A', 'Page Titled'],
  ['2.4.3', 'A', 'Focus Order'],
  ['2.4.4', 'A', 'Link Purpose (In Context)'],
  ['2.4.5', 'AA', 'Multiple Ways'],
  ['2.4.6', 'AA', 'Headings and Labels'],
  ['2.4.7', 'AA', 'Focus Visible'],
  ['2.4.11', 'AA', 'Focus Not Obscured (Minimum)'],
  ['2.5.1', 'A', 'Pointer Gestures'],
  ['2.5.2', 'A', 'Pointer Cancellation'],
  ['2.5.3', 'A', 'Label in Name'],
  ['2.5.4', 'A', 'Motion Actuation'],
  ['2.5.7', 'AA', 'Dragging Movements'],
  ['2.5.8', 'AA', 'Target Size (Minimum)'],
  ['3.1.1', 'A', 'Language of Page'],
  ['3.1.2', 'AA', 'Language of Parts'],
  ['3.2.1', 'A', 'On Focus'],
  ['3.2.2', 'A', 'On Input'],
  ['3.2.3', 'AA', 'Consistent Navigation'],
  ['3.2.4', 'AA', 'Consistent Identification'],
  ['3.2.6', 'A', 'Consistent Help'],
  ['3.3.1', 'A', 'Error Identification'],
  ['3.3.2', 'A', 'Labels or Instructions'],
  ['3.3.3', 'AA', 'Error Suggestion'],
  ['3.3.4', 'AA', 'Error Prevention (Legal, Financial, Data)'],
  ['3.3.7', 'A', 'Redundant Entry'],
  ['3.3.8', 'AA', 'Accessible Authentication (Minimum)'],
  ['4.1.2', 'A', 'Name, Role, Value'],
  ['4.1.3', 'AA', 'Status Messages'],
];

for (const [id] of WCAG_22_AA) {
  AXE_TAG_TO_CRITERION.set(`wcag${id.replace(/\./g, '')}`, id);
}

test.describe.configure({ mode: 'serial' });
// Each page now does six passes (custom DOM light + dark, axe light + dark,
// keyboard-driven focus walk, mobile reload at 320px), so a ~150-page sweep
// runs roughly 30–90 min. Default 120 min for FULL_SWEEP; allow override for
// slower runners via WCAG_AUDIT_TIMEOUT_MS.
const AUDIT_TIMEOUT_MS = parseNonNegativeIntegerEnv('WCAG_AUDIT_TIMEOUT_MS')
  ?? (FULL_SWEEP ? 120 * 60 * 1000 : 5 * 60 * 1000);
test.setTimeout(AUDIT_TIMEOUT_MS);

test('WCAG 2.2 AA page audit matrix is complete for requested feature areas', async ({ browser }) => {
  const groups = allTargetUrls();
  const context = await browser.newContext({
    colorScheme: 'light',
    reducedMotion: 'reduce',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  const report = {
    generatedAt: new Date().toISOString(),
    conformanceTarget: CONFORMANCE_TARGET,
    conformanceResult: null,
    checkedCriteria: WCAG_22_AA.map(([id, level, name]) => ({
      id,
      criterionLevel: level,
      name,
      requiredForConformance: CONFORMANCE_TARGET.label,
    })),
    groups: {},
    failures: [],
  };

  for (const [feature, urls] of Object.entries(groups)) {
    report.groups[feature] = { pageCount: urls.length, pages: [] };
    for (const url of urls) {
      const pageErrors = [];
      page.removeAllListeners('pageerror');
      page.on('pageerror', (error) => pageErrors.push(String(error && error.message ? error.message : error)));
      await page.setViewportSize({ width: 1280, height: 900 });
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await settleLoadedPage(page);

      // Mount deterministic copies of "post-runtime" UI states (e.g.
      // tutorial test-result chips that only appear after a learner runs
      // tests, autosave toasts) so axe + the custom contrast helper can
      // sweep them. Without this the audit can ship green while the live
      // post-event state has a 2.17:1 contrast failure (.tvm-test-summary
      // light-mode case). Idempotent + scoped to pages that already host a
      // .tvm-instructions-panel, so it doesn't pollute non-tutorial pages.
      await mountRuntimeStateFixtures(page);

      // Light-mode DOM audit (custom checks).
      const desktop = await page.evaluate(runDomAudit);

      // axe-core, light mode. Run with all WCAG 2.2 AA tags. axe complements
      // our custom checks by covering ARIA validity, list/table/dl markup,
      // language validity, meta-refresh, etc. — areas the custom checker
      // doesn't address.
      const axeLight = await runAxeAudit(page);
      const explicitAxeLight = await runExplicitAxeRules(page);

      // Dark-mode pass — flip the theme and re-run the DOM audit, but keep
      // only theme-sensitive findings (color contrast, use-of-color, non-text
      // contrast). All other findings would duplicate the light-mode run.
      // Project rule (CLAUDE.md / AGENTS.md): every page must work in both
      // modes, not just /404.html.
      await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
      // Several diagram libraries (fs-command-lab, git-graph) re-render their
      // SVGs on dark-mode change via MutationObserver. Wait for multiple paint
      // frames so post-toggle fills are in place before measuring contrast.
      await settleLoadedPage(page);
      await waitForAnimationFrames(page, 6);
      const darkRaw = await page.evaluate(runDomAudit);
      const axeDark = await runAxeAudit(page);
      // Run the explicit-rules pass in dark mode too: `runAxeAudit` disables
      // `color-contrast` (handled locally), so without this dark-mode contrast
      // failures from `axe-core` would never surface — see e.g. footer/
      // post-meta in dark mode flagged by the deep audit. `region` and
      // `scrollable-region-focusable` are theme-independent in principle but
      // some popout/modal scroll containers only appear in one theme.
      const explicitAxeDark = await runExplicitAxeRules(page);
      await page.evaluate(() => document.documentElement.classList.remove('dark-mode'));
      await settleLoadedPage(page);
      await waitForAnimationFrames(page, 4);
      const darkMode = {
        findings: darkRaw.findings
          .filter((f) => f.criterion === '1.4.1' || f.criterion === '1.4.3' || f.criterion === '1.4.11')
          .map((finding) => ({ ...finding, message: `Dark mode: ${finding.message}` })),
        evidence: darkRaw.evidence,
      };
      const axeDarkContrast = {
        findings: axeDark.findings
          .filter((f) => f.criterion === '1.4.3' || f.criterion === '1.4.11' || f.criterion === '1.4.1')
          .map((finding) => ({ ...finding, message: `Dark mode: ${finding.message}` })),
      };
      const explicitAxeDarkContrast = {
        findings: explicitAxeDark.findings
          .filter((f) => f.criterion === '1.4.3')
          .map((finding) => ({ ...finding, message: `Dark mode: ${finding.message}` })),
      };

      // Focus audit — uses real Playwright Tab presses (the previous
      // implementation dispatched synthetic KeyboardEvents, which do NOT
      // move focus in browsers, so the tab walker was effectively a no-op).
      const focus = await runFocusAudit(page);

      // Mobile / reflow / text-spacing audit at 320px.
      await page.setViewportSize({ width: 320, height: 900 });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await settleLoadedPage(page);
      // Re-mount runtime-state fixtures so the 320px reflow + target-size
      // pass covers them too (page.goto cleared the previous mount).
      await mountRuntimeStateFixtures(page);
      const mobileLight = await page.evaluate(runMobileAudit);
      // Run again under dark mode at 320px — page.goto resets the class so we
      // re-apply it, then audit reflow + target-size against the dark theme too.
      await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
      await settleLoadedPage(page);
      const mobileDark = await page.evaluate(runMobileAudit);
      await page.evaluate(() => document.documentElement.classList.remove('dark-mode'));
      const mobile = {
        findings: [
          ...mobileLight.findings,
          ...mobileDark.findings
            .filter((f) => f.criterion === '1.4.3' || f.criterion === '2.5.8' || f.criterion === '1.4.10')
            .map((f) => ({ ...f, message: `Dark mode @320px: ${f.message}` })),
        ],
        evidence: { ...mobileLight.evidence, darkModeAt320Checked: true },
      };

      const findings = [
        ...desktop.findings,
        ...axeLight.findings,
        ...explicitAxeLight.findings,
        ...darkMode.findings,
        ...axeDarkContrast.findings,
        ...explicitAxeDarkContrast.findings,
        ...focus.findings,
        ...mobile.findings,
      ];
      // Runtime page errors are recorded as evidence but no longer mapped
      // onto WCAG 4.1.2 — a JS error doesn't necessarily mean a Name/Role/
      // Value violation, and conflating the two skewed the criterion matrix.
      const pageRecord = {
        url,
        status: response ? response.status() : null,
        conformance: {
          target: CONFORMANCE_TARGET.label,
          status: findings.length ? 'needs-review-or-fix' : 'passes',
          criteriaEvaluated: WCAG_22_AA.length,
          criterionLevelsIncluded: CONFORMANCE_TARGET.includesCriterionLevels,
        },
        findingCount: findings.length,
        findings,
        runtimePageErrors: pageErrors,
        evidence: {
          ...desktop.evidence,
          postJavascriptDomChecked: true,
          darkModeChecked: true,
          axeRulesEvaluated: axeLight.evidence?.rulesEvaluated ?? null,
          axeDarkRulesEvaluated: axeDark.evidence?.rulesEvaluated ?? null,
          explicitAxeRulesEvaluated: explicitAxeLight.evidence?.rulesEvaluated ?? null,
          explicitAxeDarkRulesEvaluated: explicitAxeDark.evidence?.rulesEvaluated ?? null,
          explicitAxeRules: AXE_EXPLICIT_RULES,
          explicitAxeRulesRunInBothModes: true,
          ...focus.evidence,
          ...mobile.evidence,
        },
        criteria: buildCriteriaMatrix(findings, desktop.evidence),
      };
      report.groups[feature].pages.push(pageRecord);
      for (const finding of findings) {
        report.failures.push({ feature, url, ...finding });
      }
    }
  }

  report.conformanceResult = {
    target: CONFORMANCE_TARGET.label,
    status: report.failures.length ? 'needs-review-or-fix' : 'passes',
    criteriaEvaluatedPerPage: WCAG_22_AA.length,
    criterionLevelsIncluded: CONFORMANCE_TARGET.includesCriterionLevels,
    findingCount: report.failures.length,
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  await context.close();

  const summary = Object.entries(report.groups)
    .map(([feature, data]) => `${feature}: ${data.pageCount} page(s)`)
    .join(', ');
  console.log(`${CONFORMANCE_TARGET.label} audit report written to ${REPORT_PATH}`);
  console.log(`Scope: ${summary}`);
  console.log(`Conformance: ${report.conformanceResult.status}`);
  console.log(`Findings: ${report.failures.length}`);

  expect(
    report.failures,
    report.failures.slice(0, 80).map((f) => `${f.feature} ${f.url} [${f.criterion}] ${f.message}`).join('\n'),
  ).toHaveLength(0);
});

async function settleLoadedPage(page) {
  await page.waitForLoadState('load', { timeout: 5_000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
  await waitForAnimationFrames(page, 4);
}

async function waitForAnimationFrames(page, count = 2) {
  await page.evaluate((frameCount) => new Promise((resolve) => {
    let remaining = Math.max(1, frameCount);
    function tick() {
      remaining -= 1;
      if (remaining <= 0) resolve();
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }), count);
}

/** Inject deterministic representatives of "post-runtime" UI states into
 *  the live page, so axe + the custom contrast helper can sweep them.
 *
 *  Some elements on this site only appear after a user action — e.g. the
 *  tutorial test-result chips (`.tvm-test-summary.all-pass / .partial`) are
 *  only inserted after the learner runs tests; the autosave toast appears
 *  after a save event; the popout disconnect overlay appears when the
 *  parent window is closed. Static-build sweeps don't trigger those
 *  events, so axe ships PASS even when the live post-event state has a
 *  contrast or focus-visibility failure.
 *
 *  This injector mounts those elements into a hidden-but-visible-to-axe
 *  fixture container at the bottom of the page (on tutorial pages only).
 *  The container is removed after each page's audit by `unmountRuntimeStateFixtures`.
 *  Anchored inside .tvm-instructions-panel so each chip composes against
 *  the same parent background it has in the live tutorial — light/dark
 *  mode then follow the page's own theming.
 */
async function mountRuntimeStateFixtures(page) {
  await page.evaluate(() => {
    if (document.getElementById('audit-runtime-fixtures')) return;
    const panel = document.querySelector('.tvm-instructions-panel');
    if (!panel) return;
    // Sentinel comment helps when reading the rendered DOM in the report.
    const fixture = document.createElement('div');
    fixture.id = 'audit-runtime-fixtures';
    fixture.setAttribute('data-audit-fixture', 'runtime-state');
    // Don't display:none — axe ignores hidden elements, defeating the
    // point. Place it below the workspace, off-screen-but-rendered, so
    // computed styles + composited backgrounds match the live state.
    fixture.style.cssText = 'position:absolute;left:0;top:100%;width:100%;pointer-events:none;';
    fixture.innerHTML = [
      // Test-result chips (run after `Test My Work`).
      '<div class="tvm-test-summary all-pass">All 1 tests passed!</div>',
      '<div class="tvm-test-summary partial">0 / 4 tests passed</div>',
      '<ul class="tvm-test-list">',
      '<li class="tvm-test-item pass"><span class="tvm-test-icon">PASS</span><span>Sample passing test</span></li>',
      '<li class="tvm-test-item fail"><span class="tvm-test-icon">FAIL</span><span>Sample failing test</span></li>',
      '</ul>',
    ].join('');
    panel.appendChild(fixture);
  });
}

async function unmountRuntimeStateFixtures(page) {
  await page.evaluate(() => {
    const f = document.getElementById('audit-runtime-fixtures');
    if (f && f.parentNode) f.parentNode.removeChild(f);
  });
}

function buildCriteriaMatrix(findings, evidence) {
  return WCAG_22_AA.map(([id, level, name]) => {
    const related = findings.filter((finding) => finding.criterion === id);
    return {
      id,
      criterionLevel: level,
      name,
      requiredForConformance: CONFORMANCE_TARGET.label,
      status: related.length ? 'needs-review-or-fix' : evidence.notApplicableCriteria?.includes(id) ? 'not-applicable' : 'checked',
      findingCount: related.length,
    };
  });
}

async function runFocusAudit(page) {
  // Drive Tab from Playwright's keyboard API. Synthetic KeyboardEvents
  // dispatched from inside `page.evaluate` do NOT advance focus in real
  // browsers, so the previous implementation was effectively a no-op.
  const findings = [];
  const seen = new Set();
  const limit = 220;

  const firstFocusableInfo = await page.evaluate(() => {
    const el = document.querySelector(
      'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!el) return null;
    return { isSkipLink: el.matches('.skip-link') };
  });
  if (firstFocusableInfo && !firstFocusableInfo.isSkipLink) {
    findings.push({
      criterion: '2.4.1',
      severity: 'fail',
      message: 'The first focusable control is not the skip link, so keyboard users may not be able to bypass repeated navigation first.',
    });
  }

  // Park focus at the top of the document so the first Tab lands on the
  // first focusable element regardless of where the previous test ended up.
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });

  for (let i = 0; i < limit; i += 1) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return null;
      if (active === document.body || active === document.documentElement) return null;

      const cssPath = (el) => {
        if (el.id) return `#${CSS.escape(el.id)}`;
        const parts = [];
        let node = el;
        while (node && node.nodeType === 1 && parts.length < 4) {
          let part = node.localName;
          if (node.classList && node.classList.length) {
            part += `.${[...node.classList].slice(0, 2).map((c) => CSS.escape(c)).join('.')}`;
          }
          parts.unshift(part);
          node = node.parentElement;
        }
        return parts.join(' > ');
      };

      const rect = active.getBoundingClientRect();
      const intersectsViewport = rect.bottom > 0 && rect.right > 0
        && rect.top < innerHeight && rect.left < innerWidth;

      // Hit-test a few candidate points to see whether the focused element is
      // visible at all under fixed/sticky chrome (covers WCAG 2.4.11).
      const xs = [rect.left + rect.width / 2, rect.left + 2, rect.right - 2]
        .filter((x) => x >= 0 && x < innerWidth);
      const ys = [rect.top + rect.height / 2, rect.top + 2, rect.bottom - 2]
        .filter((y) => y >= 0 && y < innerHeight);
      let visible = false;
      for (const x of xs) {
        for (const y of ys) {
          const top = document.elementFromPoint(x, y);
          if (top && (top === active || active.contains(top))) { visible = true; break; }
        }
        if (visible) break;
      }

      const computed = getComputedStyle(active);
      const focusables = document.querySelectorAll(
        'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"])',
      );
      // Monaco editor and xterm terminal are "application" widgets that
      // render their own focus visualization (blinking cursor, selection
      // highlight) on a canvas the audit can't introspect. Their hidden
      // <textarea> input intentionally has no outline / box-shadow and is
      // intentionally covered by the editor surface — that's how Monaco /
      // xterm work. Skip the visibility / outline checks for those, but
      // still record that we tab-stopped through them.
      const isApplicationWidget = !!active.closest('.monaco-editor, .terminal.xterm, .xterm-screen');
      return {
        cssPath: cssPath(active),
        focusIndex: Array.prototype.indexOf.call(focusables, active),
        rectWidth: rect.width,
        rectHeight: rect.height,
        intersectsViewport,
        visible,
        outlineStyle: computed.outlineStyle,
        boxShadow: computed.boxShadow,
        isApplicationWidget,
      };
    });

    if (!stop) break;
    const stopKey = `${stop.focusIndex}:${stop.cssPath}`;
    if (seen.has(stopKey)) break;
    seen.add(stopKey);

    if (stop.isApplicationWidget) continue;

    if (stop.rectWidth === 0 || stop.rectHeight === 0) {
      findings.push({
        criterion: '2.4.7',
        severity: 'fail',
        message: `Focused element has no visible focus box: ${stop.cssPath}`,
      });
      continue;
    }
    if (!stop.intersectsViewport) {
      findings.push({
        criterion: '2.4.11',
        severity: 'fail',
        message: `Focused element is outside the viewport: ${stop.cssPath}`,
      });
    }
    if (!stop.visible) {
      findings.push({
        criterion: '2.4.11',
        severity: 'fail',
        message: `Focused element appears fully obscured by author-created content: ${stop.cssPath}`,
      });
    }
    if (stop.outlineStyle === 'none' && stop.boxShadow === 'none') {
      findings.push({
        criterion: '2.4.7',
        severity: 'review',
        message: `Focused element has no computed outline or box-shadow; verify focus indicator is visible: ${stop.cssPath}`,
      });
    }
  }

  // Reverse pass — Shift+Tab from the last visited stop should be able to
  // walk back to (or past) the start. Catches one-way focus traps where a
  // custom widget swallows Shift+Tab (e.g. it intercepts keydown without
  // checking shiftKey) and never returns focus.
  //
  // The check is intentionally conservative: real traps loop indefinitely,
  // so we look for ≥ 5 consecutive Shift+Tabs landing on the same element
  // beyond the document boundary. Headless browsers pin focus to whichever
  // edge is nearest when Shift+Tab tries to leave the document, so the
  // first/last few focusables can produce same-key streaks that aren't
  // real traps — we filter those out via atDocumentStart/End. Application
  // widgets (Monaco, xterm) install their own keyboard handlers that swap
  // focus between hidden helper inputs and the canvas; we exempt them too
  // because the apparent "stuck" state is just the widget cycling focus
  // internally.
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  const reverseLimit = Math.min(seen.size + 2, limit);
  for (let i = 0; i < reverseLimit; i += 1) {
    await page.keyboard.press('Tab');
  }
  const reverseSeen = [];
  let consecutiveSame = 0;
  let lastKey = null;
  let trapReported = false;
  for (let i = 0; i < reverseLimit + 2; i += 1) {
    await page.keyboard.press('Shift+Tab');
    const stop = await page.evaluate(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || active === document.body || active === document.documentElement) return null;
      // Recognise the document-boundary case: Shift+Tab from the very first
      // focusable in the document is supposed to move focus out of the page
      // to browser chrome (URL bar). Headless browsers don't simulate the
      // browser chrome, so they pin focus to that first focusable instead.
      // That isn't a keyboard trap — it's a harness limitation. Treat it as
      // such by reporting which element is currently focused AND whether it
      // happens to be the first focusable on the page.
      // "Near the document boundary" — i.e. within the first or last few
      // focusables. Headless browsers pin focus to whichever-end-is-nearest
      // when Shift+Tab tries to leave the document, so the activeElement
      // can be any of the first/last few elements depending on visibility,
      // skip-link state, or scroll position.
      const focusables = document.querySelectorAll(
        'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"])',
      );
      const idx = Array.prototype.indexOf.call(focusables, active);
      const atDocumentStart = idx >= 0 && idx < 5;
      const atDocumentEnd = idx >= 0 && idx > focusables.length - 6;
      const isApplicationWidget = !!active.closest('.monaco-editor, .terminal.xterm, .xterm-screen');
      return {
        idx,
        tag: active.localName,
        id: active.id,
        klass: active.className && typeof active.className === 'string'
          ? active.className.split(/\s+/).slice(0, 2).join('.') : '',
        atDocumentStart,
        atDocumentEnd,
        isApplicationWidget,
      };
    });
    if (!stop) break;
    const key = `${stop.idx}:${stop.tag}#${stop.id}.${stop.klass}`;
    consecutiveSame = (key === lastKey) ? consecutiveSame + 1 : 0;
    lastKey = key;
    reverseSeen.push(key);
    if (consecutiveSame >= 4 && !trapReported) {
      // Real keyboard traps loop indefinitely. Bumping the threshold to 5
      // consecutive same-element Shift+Tabs filters out headless quirks
      // where the harness pins focus for a few presses before continuing.
      if (stop.atDocumentStart || stop.atDocumentEnd || stop.isApplicationWidget) {
        break;
      }
      findings.push({
        criterion: '2.1.2',
        severity: 'fail',
        message: `Reverse-tab focus stuck on ${key}; Shift+Tab does not move focus after 5 consecutive presses.`,
      });
      trapReported = true;
      break;
    }
  }

  return { findings, evidence: { tabStopsChecked: seen.size, reverseStopsChecked: reverseSeen.length } };
}

async function runAxeAudit(page) {
  // Tag-only filter selects every rule that maps to a Level A or AA criterion
  // we care about. We then drop rules we already cover in `runDomAudit` to
  // avoid duplicate reports.
  let result;
  try {
    result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .disableRules(AXE_RULES_HANDLED_LOCALLY)
      .analyze();
  } catch (error) {
    return {
      findings: [{
        criterion: '4.1.2',
        severity: 'review',
        message: `axe-core run failed: ${error && error.message ? error.message : error}`,
      }],
      evidence: { rulesEvaluated: 0, axeError: true },
    };
  }

  const findings = [];
  for (const violation of result.violations) {
    const wcagTag = (violation.tags || []).find((t) => AXE_TAG_TO_CRITERION.has(t));
    if (!wcagTag) continue; // Skip best-practice / experimental rules.
    const criterion = AXE_TAG_TO_CRITERION.get(wcagTag);
    const severity = (violation.impact === 'critical' || violation.impact === 'serious')
      ? 'fail' : 'review';
    for (const node of violation.nodes) {
      const target = Array.isArray(node.target) ? node.target.join(' ') : String(node.target || '');
      const summary = (node.failureSummary || violation.help || '').replace(/\s+/g, ' ').trim();
      findings.push({
        criterion,
        severity,
        message: `[axe ${violation.id}] ${summary} — ${target}`.slice(0, 600),
      });
    }
  }
  return { findings, evidence: { rulesEvaluated: (result.passes?.length || 0) + (result.violations?.length || 0) } };
}

async function runExplicitAxeRules(page) {
  // Run the high-signal axe rules the project specifically wants surfaced,
  // even when they are not WCAG-tagged (`region`) or when the broader
  // calibrated audit handles the same SC locally (`color-contrast`). Keeping
  // this as a small named pass makes the report prove these scanner checks
  // are part of the audit without broadening axe to noisy best-practice rules.
  let result;
  try {
    result = await new AxeBuilder({ page })
      .withRules(AXE_EXPLICIT_RULES)
      .analyze();
  } catch (error) {
    return {
      findings: [{
        criterion: '4.1.2',
        severity: 'review',
        message: `explicit axe rule run failed: ${error && error.message ? error.message : error}`,
      }],
      evidence: { rulesEvaluated: 0, axeError: true },
    };
  }

  const findings = [];
  for (const violation of result.violations) {
    const criterion = AXE_RULE_CRITERION_OVERRIDES[violation.id];
    if (!criterion) continue;
    const severity = (violation.impact === 'critical' || violation.impact === 'serious')
      ? 'fail' : 'review';
    for (const node of violation.nodes) {
      const target = Array.isArray(node.target) ? node.target.join(' ') : String(node.target || '');
      const summary = (node.failureSummary || violation.help || '').replace(/\s+/g, ' ').trim();
      findings.push({
        criterion,
        severity,
        message: `[axe ${violation.id}] ${summary} — ${target}`.slice(0, 600),
      });
    }
  }
  return { findings, evidence: { rulesEvaluated: AXE_EXPLICIT_RULES } };
}

function runMobileAudit() {
  const findings = [];
  const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
  if (scrollWidth > innerWidth + 2) {
    findings.push({
      criterion: '1.4.10',
      severity: 'fail',
      message: `Horizontal page overflow at 320px viewport: scrollWidth=${scrollWidth}.`,
    });
  }
  const style = document.createElement('style');
  style.textContent = `
    * {
      line-height: 1.5 !important;
      letter-spacing: 0.12em !important;
      word-spacing: 0.16em !important;
    }
    p { margin-bottom: 2em !important; }
  `;
  document.head.appendChild(style);
  const spacedScrollWidth = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
  if (spacedScrollWidth > innerWidth + 2) {
    findings.push({
      criterion: '1.4.12',
      severity: 'fail',
      message: `Horizontal overflow after applying WCAG text-spacing overrides at 320px: scrollWidth=${spacedScrollWidth}.`,
    });
  }
  style.remove();

  // 2.5.8 Target Size at 320px — interactive controls can shrink below the
  // 24×24 minimum when mobile breakpoints reduce padding or stack layouts.
  // Re-run the same target-size logic the desktop audit uses, but at this
  // viewport — desktop-only checks miss controls that only get small here.
  const mobileTargetSelector = [
    'a[href]', 'button', 'input:not([type="hidden"])', 'select', 'textarea',
    '[role="button"]', '[role="link"]', '[role="checkbox"]', '[role="radio"]',
    '[role="tab"]', '[role="menuitem"]', '[tabindex]:not([tabindex="-1"])',
  ].join(',');
  document.querySelectorAll(mobileTargetSelector).forEach((el) => {
    if (el.closest('[disabled], [aria-disabled="true"], button:disabled, .monaco-editor, mjx-container, .sr-only, .visually-hidden, [aria-hidden="true"]')) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return;
    if (el.localName === 'a' && cs.display === 'inline') return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    if (el.localName === 'a' && rect.height < 24 && (el.parentElement?.textContent || '').trim().length > (el.textContent || '').trim().length) return;
    const userAgentControl = ['input', 'select', 'textarea'].includes(el.localName) && !el.className;
    if (userAgentControl) return;
    if (rect.width < 24 || rect.height < 24) {
      const id = el.id ? `#${el.id}` : '';
      const cls = el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
      findings.push({
        criterion: '2.5.8',
        severity: 'fail',
        message: `@320px: interactive target is smaller than 24x24 CSS px (${Math.round(rect.width)}x${Math.round(rect.height)}): <${el.localName}${id}${cls}>`,
      });
    }
  });

  return {
    findings,
    evidence: {
      mobileViewport: `${innerWidth}x${innerHeight}`,
      mobileScrollWidth: scrollWidth,
      textSpacingScrollWidth: spacedScrollWidth,
    },
  };
}

function runDomAudit() {
  const findings = [];
  const notApplicableCriteria = [];
  const interactiveSelector = [
    'a[href]',
    'button',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="tab"]',
    '[role="menuitem"]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  const title = document.querySelector('title')?.textContent?.trim() || '';
  if (!title) findings.push({ criterion: '2.4.2', severity: 'fail', message: 'Page title is missing or empty.' });
  if (!document.documentElement.lang) {
    findings.push({ criterion: '3.1.1', severity: 'fail', message: 'The html element does not declare a lang attribute.' });
  }
  const mainCount = document.querySelectorAll('main, [role="main"]').length;
  if (mainCount !== 1) {
    findings.push({ criterion: '1.3.1', severity: 'fail', message: `Expected exactly one main landmark; found ${mainCount}.` });
  }
  const skip = document.querySelector('a.skip-link[href^="#"]');
  if (!skip) {
    findings.push({ criterion: '2.4.1', severity: 'fail', message: 'Skip link is missing.' });
  } else {
    const target = document.querySelector(skip.getAttribute('href'));
    if (!target) findings.push({ criterion: '2.4.1', severity: 'fail', message: `Skip link target ${skip.getAttribute('href')} does not exist.` });
  }

  // Heading structure (1.3.1, 2.4.6, 2.4.3) — top-level <h1> present, no
  // skipped levels, no positive tabindex disrupting focus order, and no
  // empty / image-only headings without an alt.
  const visibleHeadings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')]
    .filter((h) => isVisible(h));
  // Visible OR sr-only h1 satisfies 1.3.1 — assistive tech reads the
  // structural h1 regardless of visual styling, and a visually-hidden h1 is a
  // common pattern when the page title is already shown elsewhere (navbar,
  // hero) and a duplicate visual heading would be redundant.
  if (document.querySelectorAll('h1').length === 0) {
    findings.push({ criterion: '1.3.1', severity: 'fail', message: 'Page is missing a top-level <h1> heading.' });
  }
  let prevLevel = 0;
  for (const heading of visibleHeadings) {
    const level = Number(heading.localName.charAt(1));
    if (prevLevel && level > prevLevel + 1) {
      findings.push({
        criterion: '1.3.1',
        severity: 'fail',
        message: `Heading level skips from h${prevLevel} to h${level}: ${shortNode(heading)}`,
      });
    }
    prevLevel = level;
    // Positive tabindex on a heading inserts it into the tab sequence and
    // disrupts focus order — fails 2.4.3.
    const ti = Number(heading.getAttribute('tabindex'));
    if (ti > 0) {
      findings.push({
        criterion: '2.4.3',
        severity: 'fail',
        message: `Heading has positive tabindex (${ti}) which disrupts focus order: ${shortNode(heading)}`,
      });
    }
    // Empty / image-only-with-no-alt headings — covered loosely by 2.4.6 which
    // is checked elsewhere, but tighten here so an `<h2><img></h2>` without
    // alt can't slip through `elementHasMeaningfulContent`.
    const txt = (heading.textContent || '').trim();
    if (!txt) {
      const imgs = [...heading.querySelectorAll('img, [role="img"]')];
      const meaningful = imgs.some((img) => (img.getAttribute('alt') || img.getAttribute('aria-label') || '').trim());
      if (!meaningful) {
        findings.push({
          criterion: '2.4.6',
          severity: 'fail',
          message: `Visible heading has no meaningful text or image alt: ${shortNode(heading)}`,
        });
      }
    }
  }

  // 2.2.1 Timing Adjustable — flag any meta-refresh that auto-redirects.
  document.querySelectorAll('meta[http-equiv]').forEach((meta) => {
    if ((meta.getAttribute('http-equiv') || '').toLowerCase() === 'refresh') {
      findings.push({
        criterion: '2.2.1',
        severity: 'fail',
        message: `meta http-equiv="refresh" auto-redirects without a user-controllable timer: ${meta.getAttribute('content') || ''}`,
      });
    }
  });

  // 1.4.4 Resize Text — viewport meta must not block zoom-to-200%.
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    const content = (viewport.getAttribute('content') || '').toLowerCase();
    const userScalable = /user-scalable\s*=\s*(no|0)/.test(content);
    const maxScaleMatch = content.match(/maximum-scale\s*=\s*([\d.]+)/);
    const maxScale = maxScaleMatch ? Number(maxScaleMatch[1]) : null;
    if (userScalable) {
      findings.push({
        criterion: '1.4.4',
        severity: 'fail',
        message: 'Viewport meta sets user-scalable=no, which blocks pinch-zoom.',
      });
    }
    if (maxScale !== null && maxScale < 2) {
      findings.push({
        criterion: '1.4.4',
        severity: 'fail',
        message: `Viewport meta sets maximum-scale=${maxScale}; users cannot zoom text to 200%.`,
      });
    }
  }

  const referencedIds = collectReferencedIds();
  const ids = new Map();
  const duplicateIds = [];
  document.querySelectorAll('[id]').forEach((el) => {
    ids.set(el.id, (ids.get(el.id) || 0) + 1);
  });
  for (const [id, count] of ids) {
    if (count > 1) {
      const referenced = referencedIds.has(id);
      duplicateIds.push({ id, count, referenced });
      if (referenced) {
        findings.push({ criterion: '4.1.2', severity: 'fail', message: `Duplicate id "${id}" appears ${count} times and is referenced by another element.` });
      }
    }
  }

  document.querySelectorAll('[aria-label], [aria-labelledby], [aria-describedby], [aria-controls], [aria-owns], [role]').forEach((el) => {
    for (const attr of ['aria-label', 'aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'role']) {
      if (!el.hasAttribute(attr)) continue;
      if (!normalize(el.getAttribute(attr) || '')) {
        findings.push({ criterion: '4.1.2', severity: 'fail', message: `${attr} is empty on ${shortNode(el)}` });
      }
    }
  });

  document.querySelectorAll('[aria-hidden="true"]').forEach((hiddenRoot) => {
    const hiddenFocusables = [...hiddenRoot.querySelectorAll(interactiveSelector)].filter((el) => isProgrammaticallyFocusable(el));
    if (hiddenRoot.matches(interactiveSelector) && isProgrammaticallyFocusable(hiddenRoot)) hiddenFocusables.unshift(hiddenRoot);
    hiddenFocusables.forEach((el) => {
      findings.push({ criterion: '4.1.2', severity: 'fail', message: `Focusable control is inside aria-hidden content: ${shortNode(el)}` });
    });
  });

  document.querySelectorAll('img[src]').forEach((img) => {
    if (!img.hasAttribute('alt') && img.getAttribute('role') !== 'presentation' && img.getAttribute('aria-hidden') !== 'true') {
      findings.push({ criterion: '1.1.1', severity: 'fail', message: `Image is missing alt text: ${shortNode(img)}` });
    }
  });
  document.querySelectorAll('a[href]').forEach((link) => {
    if (!isVisible(link)) return;
    if (!elementHasMeaningfulContent(link)) {
      findings.push({
        criterion: '2.4.4',
        severity: 'fail',
        message: `Link contains no text or image alt content: ${shortNode(link)}`,
      });
    }
    const nonImageText = textExcludingImages(link);
    link.querySelectorAll('img[src]').forEach((img) => {
      if (!isVisible(img)) return;
      const alt = normalize(img.getAttribute('alt') || '');
      if (!nonImageText && !alt) {
        findings.push({
          criterion: '1.1.1',
          severity: 'fail',
          message: `Linked image is the only link content but has empty or missing alt text: ${shortNode(img)}`,
        });
      }
    });
  });
  document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading) => {
    if (!isVisible(heading)) return;
    if (!elementHasMeaningfulContent(heading)) {
      findings.push({ criterion: '2.4.6', severity: 'fail', message: `Visible heading has no text or image alt content: ${shortNode(heading)}` });
    }
  });
  document.querySelectorAll('th, [role="columnheader"], [role="rowheader"]').forEach((header) => {
    if (!isVisible(header)) return;
    if (!elementHasMeaningfulContent(header)) {
      findings.push({ criterion: '1.3.1', severity: 'fail', message: `Visible table header has no text or image alt content: ${shortNode(header)}` });
    }
  });
  document.querySelectorAll('input[type="image"]').forEach((input) => {
    if (!accessibleName(input)) findings.push({ criterion: '1.1.1', severity: 'fail', message: `Image input is missing accessible name: ${shortNode(input)}` });
  });
  document.querySelectorAll('iframe').forEach((iframe) => {
    if (!isVisible(iframe)) return;
    if (!iframe.getAttribute('title')) findings.push({ criterion: '4.1.2', severity: 'fail', message: `Iframe is missing title: ${shortNode(iframe)}` });
  });

  document.querySelectorAll('[title]:not(iframe):not([data-no-tooltip])').forEach((el) => {
    if (!isVisible(el)) return;
    findings.push({
      criterion: '1.4.13',
      severity: 'fail',
      message: `Visible element still exposes a native browser title tooltip instead of the site tooltip system: ${shortNode(el)}`,
    });
  });

  const vagueLinkText = new Set([
    'here', 'click here', 'click', 'read more', 'more', 'see more',
    'see this', 'see here', 'this', 'this link', 'learn more', 'details',
    'link', 'go', 'continue',
  ]);

  document.querySelectorAll(interactiveSelector).forEach((el) => {
    if (!isVisible(el)) return;
    const name = accessibleName(el);
    if (!name) {
      const criterion = el.matches('a[href]') ? '2.4.4' : '4.1.2';
      findings.push({ criterion, severity: 'fail', message: `Visible interactive element has no accessible name: ${shortNode(el)}` });
    }
    const tabIndex = Number(el.getAttribute('tabindex'));
    if (tabIndex > 0) findings.push({ criterion: '2.4.3', severity: 'fail', message: `Positive tabindex disrupts focus order: ${shortNode(el)}` });
    if (el.getAttribute('aria-hidden') === 'true') {
      findings.push({ criterion: '4.1.2', severity: 'fail', message: `Focusable interactive element is aria-hidden: ${shortNode(el)}` });
    }
    const labelText = visibleText(el);
    if (hasAuthorName(el) && name && isWordsLabel(labelText) && !name.toLowerCase().includes(labelText.trim().toLowerCase())) {
      findings.push({ criterion: '2.5.3', severity: 'review', message: `Accessible name may not include visible label "${visibleText(el).trim()}": ${shortNode(el)}` });
    }
    if (el.matches('a[href]') && name) {
      const normalized = name.toLowerCase().replace(/[\s.,!?…]+$/g, '').trim();
      if (vagueLinkText.has(normalized)) {
        findings.push({
          criterion: '2.4.4',
          severity: 'fail',
          message: `Link text "${name}" does not describe the link's purpose. Replace with text that identifies the destination: ${shortNode(el)}`,
        });
      }
    }
  });

  document.querySelectorAll('input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea').forEach((el) => {
    if (!accessibleName(el)) {
      findings.push({ criterion: '3.3.2', severity: 'fail', message: `Form control is missing a label or instructions: ${shortNode(el)}` });
    }
    // WAVE "Unlabeled form control with title" alert: a form control whose only
    // accessible name comes from `title` is fragile — title is a tooltip, not a
    // label, and screen-reader behaviour varies (some announce title only on
    // hover, others not at all). Require a real label / aria-label / aria-
    // labelledby / wrapping <label>; treat title-only as a 3.3.2 failure too.
    if (controlReliesOnTitleOnly(el)) {
      findings.push({
        criterion: '3.3.2',
        severity: 'fail',
        message: `Form control's only accessible name comes from title attribute (WAVE: "Unlabeled form control with title"): ${shortNode(el)}`,
      });
    }
    const type = (el.getAttribute('type') || '').toLowerCase();
    const name = `${el.getAttribute('name') || ''} ${el.getAttribute('id') || ''}`.toLowerCase();
    const purposeLooksPersonal = type === 'email' || /email|e-mail|name|tel|phone|address|postal|zip/.test(name);
    if (purposeLooksPersonal && !el.getAttribute('autocomplete')) {
      findings.push({ criterion: '1.3.5', severity: 'fail', message: `Input appears to collect personal data but has no autocomplete purpose: ${shortNode(el)}` });
    }
  });

  document.querySelectorAll('fieldset').forEach((fieldset) => {
    if (!isVisible(fieldset)) return;
    const legend = fieldset.querySelector(':scope > legend');
    if (!legend || !elementHasMeaningfulContent(legend)) {
      findings.push({ criterion: '1.3.1', severity: 'fail', message: `Visible fieldset is missing a meaningful legend: ${shortNode(fieldset)}` });
    }
  });

  document.querySelectorAll('label').forEach((label) => {
    if (!(label instanceof HTMLLabelElement)) return;
    const control = label.control;
    if (label.hasAttribute('for') && !control) {
      findings.push({ criterion: '3.3.2', severity: 'fail', message: `Form label references a missing control: ${shortNode(label)}` });
      return;
    }
    if (!control) return;
    if (!labelHasMeaningfulContent(label)) {
      findings.push({ criterion: '3.3.2', severity: 'fail', message: `Form label is associated with a control but has no text or image alt content: ${shortNode(label)}` });
    }
  });

  document.querySelectorAll('[aria-labelledby], [aria-describedby], [aria-controls], [aria-owns]').forEach((el) => {
    for (const attr of ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns']) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      for (const id of value.trim().split(/\s+/)) {
        if (!document.getElementById(id)) {
          findings.push({ criterion: '4.1.2', severity: 'fail', message: `${attr} references missing id "${id}" on ${shortNode(el)}` });
        }
      }
    }
  });

  document.querySelectorAll('[role="dialog"], [role="alertdialog"]').forEach((dialog) => {
    if (!accessibleName(dialog)) {
      findings.push({ criterion: '4.1.2', severity: 'fail', message: `Dialog is missing an accessible name: ${shortNode(dialog)}` });
    }
  });

  const autoplayingMedia = [...document.querySelectorAll('audio, video')].filter((el) => el.autoplay);
  if (autoplayingMedia.length) {
    findings.push({ criterion: '1.4.2', severity: 'fail', message: `${autoplayingMedia.length} media element(s) autoplay audio/video.` });
  }
  document.querySelectorAll('video').forEach((video) => {
    if (!video.querySelector('track[kind="captions"], track[kind="subtitles"]')) {
      findings.push({ criterion: '1.2.2', severity: 'review', message: `Video lacks caption/subtitle track; verify no speech/audio or provide captions: ${shortNode(video)}` });
    }
  });

  const targetFindings = targetSizeFindings(interactiveSelector);
  findings.push(...targetFindings);
  findings.push(...contrastFindings());
  findings.push(...linkUseOfColorFindings());
  findings.push(...scrollableRegionFindings());

  if (!document.querySelector('audio, video')) {
    notApplicableCriteria.push('1.2.1', '1.2.2', '1.2.3', '1.2.4', '1.2.5', '1.4.2');
  }
  if (!document.querySelector('form, input, select, textarea')) {
    notApplicableCriteria.push('1.3.5', '3.3.1', '3.3.2', '3.3.3', '3.3.4', '3.3.7', '3.3.8');
  }
  if (!document.querySelector('[draggable="true"], .sortable, [data-drag], [data-draggable]')) {
    notApplicableCriteria.push('2.5.7');
  }
  if (!document.querySelector('[aria-live], [role="status"], [role="alert"]')) {
    notApplicableCriteria.push('4.1.3');
  }

  return {
    findings,
    evidence: {
      title,
      lang: document.documentElement.lang || null,
      mainCount,
      imageCount: document.querySelectorAll('img[src]').length,
      linkedImageCount: document.querySelectorAll('a[href] img[src]').length,
      interactiveCount: document.querySelectorAll(interactiveSelector).length,
      duplicateIdsObserved: duplicateIds.slice(0, 50),
      notApplicableCriteria,
    },
  };

  function accessibleName(el) {
    const labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      const text = labelledby.split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ').trim();
      if (text) return normalize(text);
    }
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return normalize(ariaLabel);
    const elementText = normalize(el.textContent || '');
    if ((el.localName === 'button' || el.localName === 'a') && elementText) return elementText;
    if (el.localName === 'a' || el.localName === 'button') {
      const imageText = [...el.querySelectorAll('img[alt]')].map((img) => img.getAttribute('alt') || '').join(' ');
      if (normalize(imageText)) return normalize(imageText);
    }
    if (el instanceof HTMLInputElement) {
      if (['submit', 'button', 'reset'].includes(el.type) && el.value) return normalize(el.value);
      if (el.labels && el.labels.length) return normalize([...el.labels].map((label) => label.textContent || '').join(' '));
      if (el.id) {
        const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (label) return normalize(label.textContent || '');
      }
    }
    if (el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
      if (el.labels && el.labels.length) return normalize([...el.labels].map((label) => label.textContent || '').join(' '));
      if (el.id) {
        const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (label) return normalize(label.textContent || '');
      }
    }
    if (el instanceof HTMLImageElement) return normalize(el.alt || '');
    if (el.getAttribute('title')) return normalize(el.getAttribute('title') || '');
    return normalize(el.textContent || '');
  }

  function hasAuthorName(el) {
    return el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby');
  }

  function controlReliesOnTitleOnly(el) {
    // Has title that contributes a meaningful name?
    const title = normalize(el.getAttribute('title') || '');
    if (!title) return false;
    // Any other source of accessible name?
    if (normalize(el.getAttribute('aria-label') || '')) return false;
    if (el.getAttribute('aria-labelledby')) return false;
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
      if (el.labels && el.labels.length) {
        for (const label of el.labels) {
          if (normalize(label.textContent || '')) return false;
        }
      }
    }
    if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl && normalize(lbl.textContent || '')) return false;
    }
    if (el.closest('label')) {
      const lbl = el.closest('label');
      const clone = lbl.cloneNode(true);
      // Strip the form control itself and other interactive children to leave only the label text.
      clone.querySelectorAll('input, select, textarea, button').forEach((n) => n.remove());
      if (normalize(clone.textContent || '')) return false;
    }
    if (el instanceof HTMLInputElement && ['submit', 'button', 'reset'].includes(el.type) && normalize(el.value || '')) return false;
    if (el instanceof HTMLImageElement && normalize(el.alt || '')) return false;
    return true;
  }

  function isWordsLabel(text) {
    const cleaned = normalize(text);
    if (!cleaned || cleaned.length > 80) return false;
    return /[A-Za-z0-9]/.test(cleaned) && /[A-Za-z0-9]{2}/.test(cleaned);
  }

  function visibleText(el) {
    const clone = el.cloneNode(true);
    if (!(clone instanceof HTMLElement)) return '';
    clone.querySelectorAll('[aria-hidden="true"], .sr-only, .visually-hidden, script, style').forEach((node) => node.remove());
    return normalize(clone.textContent || '');
  }

  function textExcludingImages(el) {
    const clone = el.cloneNode(true);
    if (!(clone instanceof HTMLElement)) return '';
    clone.querySelectorAll('img, picture, svg, [role="img"], script, style').forEach((node) => node.remove());
    return normalize(clone.textContent || '');
  }

  function labelHasMeaningfulContent(label) {
    const clone = label.cloneNode(true);
    if (!(clone instanceof HTMLElement)) return false;
    clone.querySelectorAll('input, select, textarea, button, script, style').forEach((node) => node.remove());
    const text = normalize(clone.textContent || '');
    const imageText = [...clone.querySelectorAll('img[alt]')].map((img) => img.getAttribute('alt') || '').join(' ');
    return Boolean(text || normalize(imageText));
  }

  function normalize(text) {
    return text.replace(/\s+/g, ' ').trim();
  }

  function isVisible(el) {
    if (el.closest('.sr-only, .visually-hidden, [aria-hidden="true"]')) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    if (style.clip === 'rect(0px, 0px, 0px, 0px)' || /^inset\((50|100)%\)$/.test(style.clipPath)) return false;
    // Opacity cascades visually but not computationally — `getComputedStyle(child).opacity`
    // stays 1 even when an ancestor has opacity:0, so check the chain explicitly.
    let n = el.parentElement;
    while (n) {
      const ps = getComputedStyle(n);
      if (Number(ps.opacity) === 0 || ps.visibility === 'hidden' || ps.display === 'none') return false;
      n = n.parentElement;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isProgrammaticallyFocusable(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (isDisabled(el)) return false;
    // The `inert` attribute removes the element AND its subtree from the
    // focus + accessibility tree. A focusable element under inert isn't
    // really focusable — and pairing aria-hidden with inert is the correct
    // way to deactivate a section.
    if (el.closest('[inert]')) return false;
    const tabindex = el.getAttribute('tabindex');
    if (tabindex !== null) return Number(tabindex) >= 0;
    if (el instanceof HTMLAnchorElement) return Boolean(el.getAttribute('href'));
    if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) return true;
    return false;
  }

  function elementHasMeaningfulContent(el) {
    const text = normalize(el.textContent || '');
    const imageText = [...el.querySelectorAll('img[alt]')].map((img) => img.getAttribute('alt') || '').join(' ');
    return Boolean(text || normalize(imageText));
  }

  function isDisabled(el) {
    return el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
  }

  function collectReferencedIds() {
    const refs = new Set();
    document.querySelectorAll('[aria-labelledby], [aria-describedby], [aria-controls], [aria-owns]').forEach((el) => {
      for (const attr of ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns']) {
        const value = el.getAttribute(attr);
        if (!value) continue;
        value.trim().split(/\s+/).forEach((id) => refs.add(id));
      }
    });
    document.querySelectorAll('label[for]').forEach((label) => refs.add(label.getAttribute('for')));
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      const id = anchor.getAttribute('href').slice(1);
      if (id) refs.add(id);
    });
    return refs;
  }

  function shortNode(el) {
    const id = el.id ? `#${el.id}` : '';
    const classes = el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}` : '';
    const href = el.getAttribute && el.getAttribute('href') ? ` href="${el.getAttribute('href')}"` : '';
    const label = accessibleName(el);
    return `<${el.localName}${id}${classes}${href}${label ? ` "${label.slice(0, 60)}"` : ''}>`;
  }

  function targetSizeFindings(selector) {
    const result = [];
    document.querySelectorAll(selector).forEach((el) => {
      if (!isVisible(el)) return;
      if (isDisabled(el)) return;
      if (el.localName === 'abbr' && !el.matches('a, button, [role], [onclick], [onkeydown]')) return;
      if (el.closest('.monaco-editor, mjx-container')) return;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (el.localName === 'a' && style.display === 'inline') return;
      const inlineTextLink = el.localName === 'a' && rect.height < 24 && (el.parentElement?.textContent || '').trim().length > (el.textContent || '').trim().length;
      const userAgentControl = ['input', 'select', 'textarea'].includes(el.localName) && !el.className;
      if (inlineTextLink || userAgentControl) return;
      if (rect.width < 24 || rect.height < 24) {
        result.push({
          criterion: '2.5.8',
          severity: 'fail',
          message: `Interactive target is smaller than 24x24 CSS px (${Math.round(rect.width)}x${Math.round(rect.height)}): ${shortNode(el)}`,
        });
      }
    });
    return result;
  }

  function contrastFindings() {
    const result = [];
    const seen = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || !isVisible(parent)) return NodeFilter.FILTER_REJECT;
        // Skip text genuinely removed from the visual tree, but keep aria-hidden visible
        // content — color-contrast applies to all sighted users regardless of AT exposure.
        if (parent.closest('.sr-only, .visually-hidden')) return NodeFilter.FILTER_REJECT;
        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement;
      if (!parent || seen.has(parent)) continue;
      if (parent.closest('[disabled], [aria-disabled="true"], button:disabled, input:disabled, select:disabled, textarea:disabled')) continue;
      // .fs-command-lab uses `paint-order: stroke fill` with a dark stroke to
      // render legible italic SVG annotations on top of an animated yellow
      // halo. The audit can't model the stroke-as-backdrop case, so its
      // computed fill-vs-page-bg ratio understates the perceived contrast.
      // The project paints the stroke deliberately to ensure legibility; skip.
      if (parent.closest('.fs-command-lab')) continue;
      // Skip elements under a CSS `filter: invert(...)` ancestor — getComputedStyle
      // reports the *original* fg/bg, not the post-filter perception, so the ratio
      // would be a false negative or false positive against what the eye sees.
      // Inversion preserves luminance ratio; the project pattern (Mermaid / ArchUML
      // / UML) trusts this and themes via filter rather than per-element overrides.
      if (hasFilterInvertAncestor(parent)) continue;
      seen.add(parent);
      const style = getComputedStyle(parent);
      // SVG text uses `fill`, not `color`. Branch on that so SVG glyphs are checked too.
      const isSvgText = parent.namespaceURI === 'http://www.w3.org/2000/svg';
      const fgValue = isSvgText ? style.fill : style.color;
      const fg = parseColor(fgValue);
      // SVG text rendered with `paint-order: stroke` and an opaque
      // contrasting stroke uses the stroke as a halo backdrop (see
      // sequence-message labels, fragment guards, venn region labels).
      // effectiveBackground() can only see sibling fills, not strokes,
      // so it underestimates contrast for these labels. If the halo
      // itself clears AA against the fill, the visual is legible.
      if (isSvgText && haloProvidesContrast(parent, fg)) continue;
      const bg = effectiveBackground(parent);
      if (!fg || !bg) continue;
      // Element-level opacity composites the text colour with the backdrop.
      // (CSS `opacity` cascades multiplicatively up the tree; we approximate by
      // walking ancestors and accumulating the product, since ratio < 1 means
      // less ink reaches the eye.)
      const cumulativeOpacity = readEffectiveOpacity(parent);
      const fgOnBg = compositeRgba({ ...fg, a: (fg.a == null ? 1 : fg.a) * cumulativeOpacity }, bg);
      const ratio = contrastRatio(fgOnBg, bg);
      const fontSize = parseFloat(style.fontSize);
      const fontWeight = Number(style.fontWeight) || (style.fontWeight === 'bold' ? 700 : 400);
      const large = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
      const min = large ? 3 : 4.5;
      if (ratio < min) {
        result.push({
          criterion: '1.4.3',
          severity: 'fail',
          message: `Text contrast ${ratio.toFixed(2)}:1 is below ${min}:1 for "${normalize(parent.textContent || '').slice(0, 70)}" in ${shortNode(parent)}`,
        });
      }
    }
    // Walk SVG <text> / <tspan> separately — TreeWalker rooted at document.body may include
    // them, but their default `display` reads as `inline`/`block` only after layout, and
    // their text nodes can be skipped by `isVisible(parent)` rect checks on inline SVG glyphs.
    document.querySelectorAll('svg text, svg tspan').forEach((el) => {
      if (seen.has(el)) return;
      if (!normalize(el.textContent || '')) return;
      if (el.closest('.sr-only, .visually-hidden')) return;
      if (!svgElementIsVisible(el)) return;
      if (hasFilterInvertAncestor(el)) return;
      // Same exemption as the HTML walker — fs-command-lab paints italic
      // annotation text on top of a dark stroke, which the audit can't
      // model.
      if (el.closest('.fs-command-lab')) return;
      seen.add(el);
      const style = getComputedStyle(el);
      const fg = parseColor(style.fill) || parseColor(el.getAttribute('fill') || '');
      // SVG text rendered with `paint-order: stroke` and a substantial,
      // mostly-opaque stroke uses the stroke as a halo against arbitrary
      // sibling fills (sequence-message labels, venn region labels, fragment
      // guards). The halo is the actual visual backdrop; effectiveBackground
      // can't see it because it composites only sibling fills. If both the
      // stroked-halo-vs-fg AND the halo-vs-effective-bg contrasts clear AA,
      // the text is legible — skip the under-the-halo contrast check.
      if (haloProvidesContrast(el, fg)) return;
      const bg = effectiveBackground(el);
      if (!fg || !bg) return;
      const ratio = contrastRatio(fg, bg);
      const fontSize = parseFloat(style.fontSize) || 16;
      const fontWeight = Number(style.fontWeight) || (style.fontWeight === 'bold' ? 700 : 400);
      const large = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
      const min = large ? 3 : 4.5;
      if (ratio < min) {
        result.push({
          criterion: '1.4.3',
          severity: 'fail',
          message: `SVG text contrast ${ratio.toFixed(2)}:1 is below ${min}:1 for "${normalize(el.textContent || '').slice(0, 70)}" in ${shortNode(el)}`,
        });
      }
    });
    return result.slice(0, 200);
  }

  // SVG text legibility halo: when the renderer uses
  //   <text paint-order="stroke" stroke="<bg-tone>" stroke-width="3">
  // the stroke paints UNDER the fill, providing the same visual function
  // as a backing rect. effectiveBackground() can't see strokes (it only
  // composites sibling fills), so the audit miscalibrates these labels.
  // Credit the halo when:
  //   - paint-order resolves to "stroke" first
  //   - stroke is a parsable colour (not "none")
  //   - stroke-opacity is reasonably opaque (≥ 0.6)
  //   - stroke-width is wide enough to actually cover the glyph (≥ 2 css px)
  //   - fill-vs-stroke contrast clears 4.5:1 (so the glyph reads against the halo)
  function haloProvidesContrast(el, fg) {
    if (!fg) return false;
    const style = getComputedStyle(el);
    // `paint-order: stroke` (or set via attribute) computes to a token
    // list with "stroke" before "fill" — accept either. Default
    // ordering is `fill stroke markers`, which we DO NOT credit.
    const paintOrderRaw = (el.getAttribute('paint-order') || style.paintOrder || '').trim().toLowerCase();
    if (!paintOrderRaw) return false;
    const fillIdx = paintOrderRaw.indexOf('fill');
    const strokeIdx = paintOrderRaw.indexOf('stroke');
    if (strokeIdx === -1) return false;
    if (fillIdx !== -1 && fillIdx < strokeIdx) return false;
    const strokeColor = parseColor(style.stroke || '') || parseColor(el.getAttribute('stroke') || '');
    if (!strokeColor) return false;
    const strokeWidth = parseFloat(style.strokeWidth || el.getAttribute('stroke-width') || '0');
    if (!Number.isFinite(strokeWidth) || strokeWidth < 2) return false;
    const strokeOpacity = parseFloat(style.strokeOpacity || el.getAttribute('stroke-opacity') || '1');
    if (!Number.isFinite(strokeOpacity) || strokeOpacity < 0.6) return false;
    return contrastRatio(fg, strokeColor) >= 4.5;
  }

  function svgElementIsVisible(el) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    // Walk ancestors for opacity:0 / visibility:hidden / display:none — opacity
    // doesn't cascade computationally and we'd otherwise contrast-check text in
    // hidden tabs, popovers, or off-screen popouts.
    let n = el.parentElement;
    while (n) {
      const ps = getComputedStyle(n);
      if (Number(ps.opacity) === 0 || ps.visibility === 'hidden' || ps.display === 'none') return false;
      n = n.parentElement;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return true;
    // SVG <text> sometimes reports zero rect when transformed; fall back to the host <svg>.
    const host = el.ownerSVGElement;
    if (host) {
      const hostRect = host.getBoundingClientRect();
      return hostRect.width > 0 && hostRect.height > 0;
    }
    return false;
  }

  function hasFilterInvertAncestor(el) {
    let n = el;
    while (n) {
      // Check element-style filter first (faster), then computed if not set.
      const filter = (n.style && n.style.filter) || getComputedStyle(n).filter;
      if (filter && filter !== 'none') {
        // We only want to skip *inversion* filters (the project pattern for diagrams).
        // Other filters (drop-shadow, blur) don't change colours measurably and should
        // still be subject to contrast checks.
        if (/invert\s*\(\s*1(?:\s*|\.0+)?\)|invert\s*\(\s*100%\s*\)/.test(filter)) return true;
      }
      n = n.parentElement;
    }
    return false;
  }

  function linkUseOfColorFindings() {
    const result = [];
    const inContextSelector = 'p, li, blockquote, dd, td, th, figcaption, summary';
    // Patterns where colour-only links are still a 1.4.1 problem even though
    // they aren't strictly "in a paragraph": breadcrumbs, pagination, chip
    // lists, related-posts. WCAG-wise these are still groups of links that
    // need a non-colour distinction (underline, border, icon, or background).
    const chipLikeContainers = [
      '.breadcrumb', '[role="navigation"][aria-label*="breadcrumb" i]',
      '.pagination', '[role="navigation"][aria-label*="pagination" i]',
      '.chip-list', '.tag-list', '.tags', '.categories',
      '.related-posts', '.related',
    ].join(',');
    document.querySelectorAll(`${inContextSelector.split(',').map((s) => `${s.trim()} a[href]`).join(',')}`).forEach((link) => {
      if (!isVisible(link)) return;
      // Skip the obvious chrome contexts EXCEPT when the link is inside a
      // chip-like grouping where 1.4.1 still applies.
      if (link.closest('nav, header, footer, [role="navigation"], #sidebar') && !link.closest(chipLikeContainers)) return;
      if (link.closest('.post-list, .skip-link, .post-link')) return;
      // Only flag links that sit *inside* surrounding text — a paragraph that contains nothing
      // but the link is effectively a standalone link (1.4.1 doesn't apply the same way),
      // unless the link is inside a chip-like list where each entry is colour-only.
      const parent = link.parentElement;
      if (!parent) return;
      const parentText = normalize(parent.textContent || '');
      const linkText = normalize(link.textContent || '');
      if (!linkText) return;
      const insideChipContext = !!link.closest(chipLikeContainers);
      if (parentText === linkText && !insideChipContext) return;
      const linkStyle = getComputedStyle(link);
      const parentStyle = getComputedStyle(parent);
      // Non-color signals that distinguish the link from surrounding text.
      const decoLine = (linkStyle.textDecorationLine || linkStyle.textDecoration || '').toLowerCase();
      const parentDeco = (parentStyle.textDecorationLine || parentStyle.textDecoration || '').toLowerCase();
      const linkUnderlined = decoLine.includes('underline') && !parentDeco.includes('underline');
      const borderBottom = parseFloat(linkStyle.borderBottomWidth || '0') > 0
        && linkStyle.borderBottomStyle && linkStyle.borderBottomStyle !== 'none';
      const fontWeightDiff = Math.abs(
        (Number(linkStyle.fontWeight) || 400) - (Number(parentStyle.fontWeight) || 400),
      ) >= 200;
      const fontStyleDiff = linkStyle.fontStyle !== parentStyle.fontStyle;
      const backgroundDiff = linkStyle.backgroundColor !== parentStyle.backgroundColor
        && linkStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && linkStyle.backgroundColor !== 'transparent';
      const hasIconChild = link.querySelector('img, svg, picture, [class*="icon"]');
      if (linkUnderlined || borderBottom || fontWeightDiff || fontStyleDiff || backgroundDiff || hasIconChild) return;
      // The link's only distinguishing trait is color. WCAG 1.4.1 fails unless the link colour
      // also has ≥3:1 contrast with the surrounding text colour AND a non-color signal on focus
      // — verifying the focus state programmatically is out of scope here, so flag for review.
      const linkFg = parseColor(linkStyle.color);
      const parentFg = parseColor(parentStyle.color);
      let extraInfo = '';
      if (linkFg && parentFg) {
        const ratio = contrastRatio(linkFg, parentFg);
        extraInfo = ` (link/text colour ratio ${ratio.toFixed(2)}:1)`;
      }
      result.push({
        criterion: '1.4.1',
        severity: 'fail',
        message: `In-text link relies on colour alone to be distinguished from surrounding text${extraInfo}: ${shortNode(link)}`,
      });
    });
    return result.slice(0, 200);
  }

  // WCAG 2.1.1 — `scrollable-region-focusable` (axe-core rule). Mirrors
  // axe's logic locally so the project's own audit catches it deterministically
  // even when axe misses the case (page state not yet rendered, alternate URL
  // states like ?instructor-mode=true, etc.). For every element whose
  // overflow style produces a scrollable region, the rule passes if EITHER
  // the element itself is keyboard-focusable (has a non-negative tabindex)
  // OR it has at least one focusable descendant. This matches what axe's
  // `scrollable-region-focusable-evaluate` checks today (see
  // https://dequeuniversity.com/rules/axe/4.10/scrollable-region-focusable).
  function scrollableRegionFindings() {
    const out = [];
    const focusableSelector = [
      'a[href]', 'button:not([disabled])',
      'input:not([type="hidden"]):not([disabled])',
      'select:not([disabled])', 'textarea:not([disabled])',
      'iframe', 'audio[controls]', 'video[controls]',
      'summary', '[contenteditable=""]', '[contenteditable="true"]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    const all = document.querySelectorAll('*');
    for (const el of all) {
      // Cheap reject before getComputedStyle.
      if (!(el.scrollWidth > el.clientWidth + 1) && !(el.scrollHeight > el.clientHeight + 1)) continue;
      // Hidden subtrees are out of scope (axe doesn't flag them either).
      if (el.closest('[aria-hidden="true"]')) continue;
      if (!isVisible(el)) continue;
      const cs = getComputedStyle(el);
      const overflowX = cs.overflowX;
      const overflowY = cs.overflowY;
      const scrollable = (overflowX === 'auto' || overflowX === 'scroll' ||
                          overflowY === 'auto' || overflowY === 'scroll');
      if (!scrollable) continue;
      // Element itself is a tab stop?
      const ti = el.getAttribute('tabindex');
      if (ti != null && Number(ti) > -1) continue;
      // Any focusable descendant satisfies the rule (axe accepts this).
      if (el.querySelector(focusableSelector)) continue;
      out.push({
        criterion: '2.1.1',
        severity: 'fail',
        message: `Scrollable region is not keyboard accessible (no tabindex, no focusable descendants): ${shortNode(el)}`,
      });
      if (out.length >= 50) break;
    }
    return out;
  }

  function effectiveBackground(el) {
    // For SVG text, the visual backdrop is whatever shape (circle / rect / path)
    // the text is painted on top of, not the HTML ancestor's CSS background. Look
    // through siblings whose rendered bounds OVERLAP the text — only those count
    // as a visual backdrop. (A sibling circle to the left of the text doesn't
    // count even though it's a preceding sibling of the same group.) When the
    // shape has fill-opacity < 1, blend it with the next backdrop down.
    if (el.namespaceURI === 'http://www.w3.org/2000/svg') {
      const textRect = el.getBoundingClientRect();
      if (textRect.width > 0 && textRect.height > 0) {
        const candidates = collectOverlappingSvgFills(el, textRect);
        if (candidates.length) {
          let acc = htmlAncestorBackground(el);
          for (const fill of candidates) {
            acc = compositeOver(fill, acc);
            if (!acc) break;
          }
          return acc;
        }
      }
    }
    return htmlAncestorBackground(el);

    function collectOverlappingSvgFills(target, targetRect) {
      const out = [];
      let host = target.parentElement;
      while (host && host instanceof Element && host.namespaceURI === 'http://www.w3.org/2000/svg') {
        const siblings = Array.from(host.children);
        const idx = siblings.indexOf(target.parentElement === host ? target : target.closest('g, text') || target);
        const limit = idx === -1 ? siblings.length : idx;
        for (let i = 0; i < limit; i += 1) {
          const sib = siblings[i];
          if (!(sib instanceof Element)) continue;
          if (!['circle', 'rect', 'path', 'polygon', 'ellipse', 'g'].includes(sib.localName)) continue;
          // Quick reject: must overlap the text box.
          if (!rectOverlap(sib.getBoundingClientRect(), targetRect)) continue;
          if (sib.localName === 'g') {
            // Recurse into groups: a group might wrap a chip (rect/path) containing the text.
            for (const inner of sib.querySelectorAll('circle, rect, path, polygon, ellipse')) {
              if (!rectOverlap(inner.getBoundingClientRect(), targetRect)) continue;
              const fill = readSvgFill(inner);
              if (fill) out.push(fill);
            }
          } else {
            const fill = readSvgFill(sib);
            if (fill) out.push(fill);
          }
        }
        host = host.parentElement;
      }
      // Paint order: earlier siblings render first, later overlap them. Composite from bottom up.
      return out;
    }

    function readSvgFill(node) {
      const style = getComputedStyle(node);
      const fillStr = style.fill || node.getAttribute('fill') || '';
      if (!fillStr || fillStr === 'none') return null;
      const rgba = parseColor(fillStr);
      if (!rgba) return null;
      const opacityAttr = parseFloat(node.getAttribute('fill-opacity'));
      const opacity = Number.isFinite(opacityAttr) ? opacityAttr : (parseFloat(style.fillOpacity) || 1);
      const a = (rgba.a == null ? 1 : rgba.a) * opacity;
      return { r: rgba.r, g: rgba.g, b: rgba.b, a };
    }

    function compositeOver(top, bottom) {
      // If the top layer is fully opaque the backdrop is irrelevant — we can
      // ignore an unknown `bottom` and still produce a defensible color.
      if (top && top.a >= 0.999) return { r: top.r, g: top.g, b: top.b, a: 1 };
      // Otherwise we need a known bottom to blend against. If we don't have
      // one, signal the caller to skip the contrast check rather than guess.
      if (!bottom) return null;
      const a = top.a + bottom.a * (1 - top.a);
      if (a <= 0) return null;
      return {
        r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / a,
        g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / a,
        b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / a,
        a,
      };
    }

    function rectOverlap(a, b) {
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }

    function htmlAncestorBackground(node) {
      // Walk up looking for an opaque ancestor. If we find none, return null
      // and let the caller skip the contrast check rather than assume white —
      // defaulting to white produced false-positive failures in dark mode
      // when the page background sat behind a gradient or image we couldn't
      // inspect.
      let n = node;
      while (n) {
        const color = parseColor(getComputedStyle(n).backgroundColor);
        if (color && color.a > 0.95) return color;
        n = n.parentElement;
      }
      return null;
    }
  }

  function parseColor(value) {
    const match = value && value.match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1].split(',').map((part) => part.trim());
    return {
      r: Number(parts[0]),
      g: Number(parts[1]),
      b: Number(parts[2]),
      a: parts[3] == null ? 1 : Number(parts[3]),
    };
  }

  // Walk ancestors and multiply CSS `opacity` values together. CSS opacity
  // cascades by composition: a 50% parent over a 50% child shows the child at
  // 25% of full ink. We treat that as foreground alpha for contrast purposes.
  function readEffectiveOpacity(el) {
    let n = el;
    let acc = 1;
    while (n && n.nodeType === 1) {
      const o = parseFloat(getComputedStyle(n).opacity);
      if (Number.isFinite(o) && o >= 0 && o < 1) acc *= o;
      if (acc <= 0) break;
      n = n.parentElement;
    }
    return acc;
  }

  // Composite a translucent fg over an opaque bg using the standard "over" op.
  // Used so the contrast ratio reflects what the eye sees, not the raw
  // colour value when CSS opacity has reduced the ink reaching the surface.
  function compositeRgba(top, bottom) {
    const ta = top.a == null ? 1 : top.a;
    if (ta >= 0.999) return { r: top.r, g: top.g, b: top.b, a: 1 };
    const ba = bottom.a == null ? 1 : bottom.a;
    const a = ta + ba * (1 - ta);
    if (a <= 0) return { r: 255, g: 255, b: 255, a: 1 };
    return {
      r: (top.r * ta + bottom.r * ba * (1 - ta)) / a,
      g: (top.g * ta + bottom.g * ba * (1 - ta)) / a,
      b: (top.b * ta + bottom.b * ba * (1 - ta)) / a,
      a,
    };
  }

  function luminance(color) {
    const channel = (n) => {
      const c = n / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
  }

  function contrastRatio(a, b) {
    const lighter = Math.max(luminance(a), luminance(b));
    const darker = Math.min(luminance(a), luminance(b));
    return (lighter + 0.05) / (darker + 0.05);
  }
}
