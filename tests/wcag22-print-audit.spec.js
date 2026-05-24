// @ts-check
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE_ROOT = path.join(ROOT, '_site');
const REPORT_PATH = path.join(ROOT, 'tmp', process.env.WCAG_PRINT_AUDIT_REPORT_NAME || 'wcag22-print-audit-results.json');

const FULL_SWEEP = process.env.WCAG_AUDIT_FULL_SWEEP === '1' || process.env.WCAG_PRINT_AUDIT_FULL_SWEEP === '1';
const URL_FILTER = process.env.WCAG_PRINT_AUDIT_URL_FILTER
  ? new RegExp(process.env.WCAG_PRINT_AUDIT_URL_FILTER)
  : process.env.WCAG_AUDIT_URL_FILTER
    ? new RegExp(process.env.WCAG_AUDIT_URL_FILTER)
    : null;
const EXPLICIT_PAGE_LIMIT = parseNonNegativeIntegerEnv('WCAG_PRINT_AUDIT_PAGE_LIMIT');
const MAX_PAGES_PER_FEATURE = EXPLICIT_PAGE_LIMIT ?? (FULL_SWEEP || URL_FILTER ? 0 : 1);

const PRINT_AUDIT_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const AXE_RULES_HANDLED_LOCALLY = ['color-contrast', 'link-in-text-block', 'target-size'];
const PRINT_AUDIT_TIMEOUT_MS = parseNonNegativeIntegerEnv('WCAG_PRINT_AUDIT_TIMEOUT_MS')
  ?? (FULL_SWEEP ? 120 * 60 * 1000 : 10 * 60 * 1000);

test.describe.configure({ mode: 'serial' });
test.setTimeout(PRINT_AUDIT_TIMEOUT_MS);

test('print media keeps reachable layouts light, readable, and WCAG 2.2 AA compatible under dark preference', async ({ browser }) => {
  const groups = allTargetUrlsByFeature();
  const context = await browser.newContext({
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  await page.emulateMedia({ media: 'print', colorScheme: 'dark', reducedMotion: 'reduce' });

  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'print',
    colorSchemePreference: 'dark',
    groups: {},
    failures: [],
  };

  for (const [feature, urls] of Object.entries(groups)) {
    report.groups[feature] = { pageCount: urls.length, pages: [] };
    for (const url of urls) {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await settleLoadedPage(page);
      await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
      await page.emulateMedia({ media: 'print', colorScheme: 'dark', reducedMotion: 'reduce' });
      await settleLoadedPage(page);
      await waitForAnimationFrames(page, 4);

      const printDom = await page.evaluate(runPrintDomAudit);
      const axe = await runAxeAudit(page);
      const findings = [...printDom.findings, ...axe.findings];
      const pageRecord = {
        url,
        status: response ? response.status() : null,
        findingCount: findings.length,
        findings,
        evidence: {
          ...printDom.evidence,
          axeRulesEvaluated: axe.rulesEvaluated,
          printMediaEmulated: true,
          darkPreferenceApplied: true,
        },
      };
      report.groups[feature].pages.push(pageRecord);
      for (const finding of findings) {
        report.failures.push({ feature, url, ...finding });
      }
    }
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  await context.close();

  const summary = Object.entries(report.groups)
    .map(([feature, data]) => `${feature}: ${data.pageCount} page(s)`)
    .join(', ');
  console.log(`WCAG 2.2 AA print audit report written to ${REPORT_PATH}`);
  console.log(`Scope: ${summary}`);
  console.log(`Findings: ${report.failures.length}`);

  expect(
    report.failures,
    report.failures.slice(0, 80).map((f) => `${f.feature} ${f.url} [${f.criterion}] ${f.message}`).join('\n'),
  ).toHaveLength(0);
});

function parseNonNegativeIntegerEnv(name) {
  const raw = process.env[name];
  if (raw == null || raw === '') return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer, got ${JSON.stringify(raw)}`);
  }
  return value;
}

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
    if (fs.existsSync(printIndex)) urls.add(`/${printPath}/`);
    if (fs.existsSync(printHtml)) urls.add(`/${printPath}.html`);
  }
  return [...urls].sort();
}

function allTargetUrlsByFeature() {
  const htmlFiles = walk(SITE_ROOT).filter((file) => file.endsWith('.html'));
  const urls = htmlFiles.map(urlFromSiteFile).filter(Boolean);
  const tutorialSet = new Set(sourceTutorialUrls());
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
    tutorials: urls.filter((url) => tutorialSet.has(url) && !url.includes('/print')),
    tutorialPrint: urls.filter((url) => tutorialSet.has(url) && url.includes('/print')),
    sebook: urls.filter((url) => url.startsWith('/SEBook/') && !tutorialSet.has(url)),
    seGym: urls.filter((url) => url === '/se-gym/' || url.startsWith('/se-gym/')),
    blog: urls.filter((url) => url === '/blog/' || url.startsWith('/blog/')),
    popouts: urls.filter((url) => /(?:^\/tutorial-.*-popup\.html$|^\/uml-popup\.html$)/.test(url)),
  };

  for (const key of Object.keys(groups)) {
    groups[key].sort();
    if (URL_FILTER) groups[key] = groups[key].filter((url) => URL_FILTER.test(url));
    if (MAX_PAGES_PER_FEATURE > 0) groups[key] = groups[key].slice(0, MAX_PAGES_PER_FEATURE);
  }
  return groups;
}

async function settleLoadedPage(page) {
  await page.waitForLoadState('load', { timeout: 5_000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
  await waitForAnimationFrames(page, 3);
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

async function runAxeAudit(page) {
  const results = await new AxeBuilder({ page })
    .withTags(PRINT_AUDIT_TAGS)
    .disableRules(AXE_RULES_HANDLED_LOCALLY)
    .analyze();
  return {
    rulesEvaluated: results.passes.length + results.violations.length + results.inapplicable.length,
    findings: results.violations.flatMap((violation) => violation.nodes.map((node) => ({
      criterion: criterionFromAxeViolation(violation),
      severity: 'fail',
      message: `${violation.id}: ${violation.help} at ${node.target.join(', ')}`,
    }))),
  };
}

function criterionFromAxeViolation(violation) {
  const explicit = {
    region: '1.3.1',
    'scrollable-region-focusable': '2.1.1',
    'color-contrast': '1.4.3',
    'target-size': '2.5.8',
  };
  if (explicit[violation.id]) return explicit[violation.id];
  const tag = violation.tags.find((t) => /^wcag\d+$/.test(t));
  if (!tag) return 'unknown';
  const digits = tag.replace('wcag', '');
  if (digits.length === 3) return `${digits[0]}.${digits[1]}.${digits[2]}`;
  if (digits.length === 4) return `${digits[0]}.${digits[1]}.${digits.slice(2)}`;
  return tag;
}

function runPrintDomAudit() {
  const findings = [];
  const rootStyle = getComputedStyle(document.documentElement);
  const bodyStyle = getComputedStyle(document.body);
  const bodyBg = effectiveBackground(document.body) || parseColor(bodyStyle.backgroundColor);
  const bodyFg = parseColor(bodyStyle.color);

  if (!bodyBg || luminance(bodyBg) < 0.92) {
    findings.push({
      criterion: '1.4.3',
      severity: 'fail',
      message: `Print page background is not light enough under dark preference: html=${rootStyle.backgroundColor}, body=${bodyStyle.backgroundColor}`,
    });
  }

  if (bodyBg && bodyFg && contrastRatio(bodyFg, bodyBg) < 4.5) {
    findings.push({
      criterion: '1.4.3',
      severity: 'fail',
      message: `Print body text contrast ${contrastRatio(bodyFg, bodyBg).toFixed(2)}:1 is below 4.5:1 under dark preference.`,
    });
  }

  findings.push(...darkSurfaceFindings());
  findings.push(...textContrastFindings());
  findings.push(...quizCheckboxFindings());
  findings.push(...sebookHeroFindings());

  return {
    findings: findings.slice(0, 200),
    evidence: {
      bodyBackground: bodyStyle.backgroundColor,
      bodyColor: bodyStyle.color,
      rootHasDarkModeClass: document.documentElement.classList.contains('dark-mode'),
      printLightModeClassPresent: document.documentElement.classList.contains('print-light-mode'),
    },
  };

  function darkSurfaceFindings() {
    const out = [];
    document.querySelectorAll('body *').forEach((el) => {
      if (!(el instanceof HTMLElement) || !isVisible(el)) return;
      if (el.closest('svg, img, picture, canvas, video')) return;
      const rect = el.getBoundingClientRect();
      if (rect.width * rect.height < 8_000) return;
      const bg = parseColor(getComputedStyle(el).backgroundColor);
      if (!bg || bg.a < 0.95 || luminance(bg) >= 0.35) return;
      out.push({
        criterion: '1.4.3',
        severity: 'fail',
        message: `Large dark print surface remains visible under dark preference: ${shortNode(el)} background ${getComputedStyle(el).backgroundColor}`,
      });
    });
    return out.slice(0, 40);
  }

  function textContrastFindings() {
    const out = [];
    const seen = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || !isVisible(parent)) return NodeFilter.FILTER_REJECT;
        if (parent.closest('.sr-only, .visually-hidden')) return NodeFilter.FILTER_REJECT;
        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement;
      if (!parent || seen.has(parent)) continue;
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
        out.push({
          criterion: '1.4.3',
          severity: 'fail',
          message: `Print text contrast ${ratio.toFixed(2)}:1 is below ${min}:1 for "${normalize(parent.textContent || '').slice(0, 70)}" in ${shortNode(parent)}`,
        });
      }
    }
    return out.slice(0, 100);
  }

  function quizCheckboxFindings() {
    const out = [];
    document.querySelectorAll('.quiz-container .option-checkbox, .tvm-quiz-panel .option-checkbox, .workout-quiz-card .option-checkbox')
      .forEach((el) => {
        if (!(el instanceof HTMLElement) || !isVisible(el)) return;
        const style = getComputedStyle(el);
        const bg = parseColor(style.backgroundColor);
        const border = parseColor(style.borderTopColor);
        if (!bg || luminance(bg) < 0.9) {
          out.push({
            criterion: '1.4.11',
            severity: 'fail',
            message: `Print quiz checkbox does not use a light fill: ${shortNode(el)} background ${style.backgroundColor}`,
          });
        }
        if (bg && border && contrastRatio(border, bg) < 3) {
          out.push({
            criterion: '1.4.11',
            severity: 'fail',
            message: `Print quiz checkbox border contrast ${contrastRatio(border, bg).toFixed(2)}:1 is below 3:1 in ${shortNode(el)}`,
          });
        }
      });
    return out;
  }

  function sebookHeroFindings() {
    const out = [];
    if (!document.body.classList.contains('sebook-layout') || document.body.classList.contains('se-gym-page')) {
      return out;
    }
    document.querySelectorAll('.quiz-avatar-side, .flashcards-avatar-side, .tvm-quiz-avatar-wrap, .tvm-hero-celebration-avatar')
      .forEach((el) => {
        if (el instanceof HTMLElement && isVisible(el)) {
          out.push({
            criterion: '1.3.2',
            severity: 'fail',
            message: `SEBook print view still renders a gym/avatar sidecar: ${shortNode(el)}`,
          });
        }
      });
    return out;
  }

  function effectiveBackground(el) {
    let n = el;
    while (n) {
      const bg = parseColor(getComputedStyle(n).backgroundColor);
      if (bg && bg.a > 0.95) return bg;
      n = n.parentElement;
    }
    return parseColor(getComputedStyle(document.body).backgroundColor)
      || parseColor(getComputedStyle(document.documentElement).backgroundColor)
      || { r: 255, g: 255, b: 255, a: 1 };
  }

  function isVisible(el) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    return true;
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

  function normalize(value) {
    return value.replace(/\s+/g, ' ').trim();
  }

  function shortNode(el) {
    const id = el.id ? `#${el.id}` : '';
    const classes = el.className && typeof el.className === 'string'
      ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}`
      : '';
    return `<${el.tagName.toLowerCase()}${id}${classes}>`;
  }
}
