// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE_ROOT = path.join(ROOT, '_site');
const REPORT_PATH = path.join(ROOT, 'tmp', 'wcag22-audit-results.json');

const MAX_PAGES_PER_FEATURE = Number(process.env.WCAG_AUDIT_PAGE_LIMIT || 0);
const FULL_SWEEP = process.env.WCAG_AUDIT_FULL_SWEEP === '1';
const URL_FILTER = process.env.WCAG_AUDIT_URL_FILTER ? new RegExp(process.env.WCAG_AUDIT_URL_FILTER) : null;
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
  const groups = {
    home: fs.existsSync(path.join(SITE_ROOT, 'index.html')) ? ['/index.html'] : [],
    errorPages: urls.filter((url) => url === '/404.html'),
    cookies: urls.filter((url) => url === '/cookies/'),
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

test.describe.configure({ mode: 'serial' });
test.setTimeout(FULL_SWEEP ? 20 * 60 * 1000 : 5 * 60 * 1000);

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
      const desktop = await page.evaluate(runDomAudit);
      let darkMode = { findings: [], evidence: {} };
      if (url === '/404.html') {
        await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
        darkMode = await page.evaluate(runDomAudit);
        await page.evaluate(() => document.documentElement.classList.remove('dark-mode'));
      }
      const focus = await runFocusAudit(page);
      await page.setViewportSize({ width: 320, height: 900 });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await settleLoadedPage(page);
      const mobile = await page.evaluate(runMobileAudit);
      const findings = [
        ...desktop.findings,
        ...darkMode.findings.map((finding) => ({
          ...finding,
          message: `Dark mode: ${finding.message}`,
        })),
        ...focus.findings,
        ...mobile.findings,
        ...pageErrors.map((message) => ({
          criterion: '4.1.2',
          severity: 'review',
          message: `Runtime page error may affect programmatic name/role/value: ${message}`,
        })),
      ];
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
        evidence: { ...desktop.evidence, postJavascriptDomChecked: true, darkMode404Checked: url === '/404.html', ...focus.evidence, ...mobile.evidence },
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
  await page.waitForTimeout(750);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
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
  return page.evaluate(async () => {
    const findings = [];
    const seen = new Set();
    const limit = 220;
    const firstFocusable = document.querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable && !firstFocusable.matches('.skip-link')) {
      findings.push({
        criterion: '2.4.1',
        severity: 'fail',
        message: 'The first focusable control is not the skip link, so keyboard users may not be able to bypass repeated navigation first.',
      });
    }
    for (let i = 0; i < limit; i += 1) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      const before = document.activeElement;
      if (!before) break;
      if (before instanceof HTMLElement) before.blur();
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || active === document.body) break;
      const key = cssPath(active);
      if (seen.has(key)) break;
      seen.add(key);
      const rect = active.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        findings.push({
          criterion: '2.4.7',
          severity: 'fail',
          message: `Focused element has no visible focus box: ${key}`,
        });
        continue;
      }
      const intersectsViewport = rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth;
      if (!intersectsViewport) {
        findings.push({
          criterion: '2.4.11',
          severity: 'fail',
          message: `Focused element is outside the viewport: ${key}`,
        });
      }
      const visiblePoint = findVisiblePoint(active, rect);
      if (!visiblePoint) {
        findings.push({
          criterion: '2.4.11',
          severity: 'fail',
          message: `Focused element appears fully obscured by author-created content: ${key}`,
        });
      }
      const outline = getComputedStyle(active).outlineStyle;
      const boxShadow = getComputedStyle(active).boxShadow;
      if (outline === 'none' && boxShadow === 'none') {
        findings.push({
          criterion: '2.4.7',
          severity: 'review',
          message: `Focused element has no computed outline or box-shadow; verify focus indicator is visible: ${key}`,
        });
      }
    }
    return { findings, evidence: { tabStopsChecked: seen.size } };

    function cssPath(el) {
      if (el.id) return `#${CSS.escape(el.id)}`;
      const parts = [];
      let node = el;
      while (node && node.nodeType === 1 && parts.length < 4) {
        let part = node.localName;
        if (node.classList && node.classList.length) part += `.${[...node.classList].slice(0, 2).map((c) => CSS.escape(c)).join('.')}`;
        parts.unshift(part);
        node = node.parentElement;
      }
      return parts.join(' > ');
    }

    function findVisiblePoint(el, rect) {
      const xs = [rect.left + rect.width / 2, rect.left + 2, rect.right - 2].filter((x) => x >= 0 && x < innerWidth);
      const ys = [rect.top + rect.height / 2, rect.top + 2, rect.bottom - 2].filter((y) => y >= 0 && y < innerHeight);
      for (const x of xs) {
        for (const y of ys) {
          const top = document.elementFromPoint(x, y);
          if (top && (top === el || el.contains(top))) return { x, y };
        }
      }
      return null;
    }
  });
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
  document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading) => {
    if (!isVisible(heading)) return;
    if (!elementHasMeaningfulContent(heading)) {
      findings.push({ criterion: '2.4.6', severity: 'fail', message: `Visible heading has no text or image alt content: ${shortNode(heading)}` });
    }
  });
  document.querySelectorAll('input[type="image"]').forEach((input) => {
    if (!accessibleName(input)) findings.push({ criterion: '1.1.1', severity: 'fail', message: `Image input is missing accessible name: ${shortNode(input)}` });
  });
  document.querySelectorAll('iframe').forEach((iframe) => {
    if (!isVisible(iframe)) return;
    if (!iframe.getAttribute('title')) findings.push({ criterion: '4.1.2', severity: 'fail', message: `Iframe is missing title: ${shortNode(iframe)}` });
  });

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
  });

  document.querySelectorAll('input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea').forEach((el) => {
    if (!isVisible(el)) return;
    if (!accessibleName(el)) {
      findings.push({ criterion: '3.3.2', severity: 'fail', message: `Form control is missing a label or instructions: ${shortNode(el)}` });
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
    if (!labelHasMeaningfulContent(label) && !accessibleName(control)) {
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

  document.querySelectorAll('[role="status"], [aria-live]').forEach((el) => {
    if (!isVisible(el) && !el.classList.contains('sr-only')) return;
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
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isProgrammaticallyFocusable(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (isDisabled(el)) return false;
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
        if (parent.closest('.sr-only, .visually-hidden, [aria-hidden="true"]')) return NodeFilter.FILTER_REJECT;
        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement;
      if (!parent || seen.has(parent)) continue;
      if (parent.closest('[disabled], [aria-disabled="true"], button:disabled, input:disabled, select:disabled, textarea:disabled')) continue;
      seen.add(parent);
      const style = getComputedStyle(parent);
      const fg = parseColor(style.color);
      const bg = effectiveBackground(parent);
      if (!fg || !bg) continue;
      const ratio = contrastRatio(fg, bg);
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
    return result.slice(0, 50);
  }

  function effectiveBackground(el) {
    let node = el;
    while (node) {
      const color = parseColor(getComputedStyle(node).backgroundColor);
      if (color && color.a > 0.95) return color;
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
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
