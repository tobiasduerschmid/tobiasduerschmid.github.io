// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'tmp', 'wcag22-source-implementation-sweep.json');
const SOURCE_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.md', '.scss', '.yml']);
const EXCLUDED_DIRS = new Set([
  '.git',
  '.claude',
  '_site',
  'node_modules',
  'playwright-report',
  'test-results',
  'tmp',
]);

const MANUAL_OR_FLOW_CRITERIA = [
  {
    id: '1.2.1',
    level: 'A',
    name: 'Audio-only and Video-only (Prerecorded)',
    whyManual: 'Requires confirming media alternatives are equivalent to the media content.',
    patterns: ['transcript', '<audio', '<video', 'audio_player', 'captions'],
  },
  {
    id: '1.2.2',
    level: 'A',
    name: 'Captions (Prerecorded)',
    whyManual: 'Requires confirming captions cover all meaningful prerecorded audio.',
    patterns: ['track kind="captions"', 'track kind="subtitles"', 'captions', 'transcript'],
  },
  {
    id: '1.2.3',
    level: 'A',
    name: 'Audio Description or Media Alternative (Prerecorded)',
    whyManual: 'Requires confirming visual information in video is available through audio description or an alternative.',
    patterns: ['audio description', 'transcript', 'media alternative', '<video'],
  },
  {
    id: '1.2.4',
    level: 'AA',
    name: 'Captions (Live)',
    whyManual: 'Requires knowing whether live synchronized media exists and whether live captions are provided.',
    patterns: ['live captions', 'captions', '<video'],
  },
  {
    id: '1.2.5',
    level: 'AA',
    name: 'Audio Description (Prerecorded)',
    whyManual: 'Requires content judgment about prerecorded video visual-only information.',
    patterns: ['audio description', 'transcript', '<video'],
  },
  {
    id: '1.3.2',
    level: 'A',
    name: 'Meaningful Sequence',
    whyManual: 'Requires checking that rendered order preserves meaning, especially with CSS layout and generated widgets.',
    patterns: ['<main', '<nav', '<h1', '<h2', '<ol', '<ul', 'grid-template', 'flex-direction'],
  },
  {
    id: '1.3.3',
    level: 'A',
    name: 'Sensory Characteristics',
    whyManual: 'Requires reading instructional text to confirm it does not rely only on shape, color, location, or sound.',
    patterns: ['aria-label', 'sr-only', 'visually-hidden', 'label', 'instructions'],
  },
  {
    id: '1.4.1',
    level: 'A',
    name: 'Use of Color',
    whyManual: 'Requires content judgment that color-coded states also have text, icons, or programmatic labels.',
    patterns: ['aria-label', 'sr-only', 'correct', 'incorrect', 'success', 'error', 'warning'],
  },
  {
    id: '1.4.5',
    level: 'AA',
    name: 'Images of Text',
    whyManual: 'Requires inspecting whether images contain necessary text and whether that text is available as real text.',
    patterns: ['<img', 'alt=', 'aria-label', 'figcaption'],
  },
  {
    id: '1.4.11',
    level: 'AA',
    name: 'Non-text Contrast',
    whyManual: 'Requires visual judgment for controls, charts, focus indicators, and generated SVGs.',
    patterns: [':focus', 'outline', 'border-color', 'box-shadow', 'focus-visible'],
  },
  {
    id: '1.4.13',
    level: 'AA',
    name: 'Content on Hover or Focus',
    whyManual: 'Requires interaction testing for dismissible, hoverable, and persistent hover/focus content.',
    patterns: [':hover', ':focus', 'tooltip', 'mouseenter', 'mouseleave', 'Escape'],
  },
  {
    id: '2.1.1',
    level: 'A',
    name: 'Keyboard',
    whyManual: 'Requires operating interactive flows by keyboard, beyond checking for handlers and focusable elements.',
    patterns: ['keydown', 'keyup', 'tabindex', '<button', 'role="button"', 'Spacebar', 'Enter'],
  },
  {
    id: '2.1.2',
    level: 'A',
    name: 'No Keyboard Trap',
    whyManual: 'Requires exercising focus movement through modals, popouts, tutorials, and widgets.',
    patterns: ['Escape', 'blur', 'focus', 'modal', 'dialog', 'window.open'],
  },
  {
    id: '2.2.1',
    level: 'A',
    name: 'Timing Adjustable',
    whyManual: 'Requires knowing whether any timers are user-facing time limits.',
    patterns: ['setTimeout', 'setInterval', 'timer', 'countdown', 'autoplay'],
  },
  {
    id: '2.2.2',
    level: 'A',
    name: 'Pause, Stop, Hide',
    whyManual: 'Requires confirming moving/auto-updating content can be paused or stopped.',
    patterns: ['carousel-pause', 'pause', 'prefers-reduced-motion', 'reducedMotion', 'autoplay'],
  },
  {
    id: '2.3.1',
    level: 'A',
    name: 'Three Flashes or Below Threshold',
    whyManual: 'Requires visual inspection of animations and transient effects.',
    patterns: ['animation', 'transition', 'flash', 'prefers-reduced-motion', 'confetti'],
  },
  {
    id: '2.4.3',
    level: 'A',
    name: 'Focus Order',
    whyManual: 'Requires keyboard traversal to verify focus follows the visual and logical order.',
    patterns: ['tabindex', 'focus', 'skip-link', '<main'],
  },
  {
    id: '2.4.4',
    level: 'A',
    name: 'Link Purpose (In Context)',
    whyManual: 'Requires reading link text in context.',
    patterns: ['aria-label', 'title=', '<a ', 'sr-only'],
  },
  {
    id: '2.4.5',
    level: 'AA',
    name: 'Multiple Ways',
    whyManual: 'Requires confirming more than one navigation method exists for non-process pages.',
    patterns: ['navbar', '<nav', 'sitemap', 'breadcrumbs', 'search', 'SEBook'],
  },
  {
    id: '2.4.6',
    level: 'AA',
    name: 'Headings and Labels',
    whyManual: 'Requires judging whether headings and labels describe the following content or controls.',
    patterns: ['<h1', '<h2', '<h3', '<label', 'aria-label', 'aria-labelledby'],
  },
  {
    id: '2.5.1',
    level: 'A',
    name: 'Pointer Gestures',
    whyManual: 'Requires confirming multipoint/path gestures have single-pointer alternatives.',
    patterns: ['pointerdown', 'pointerup', 'click', 'drag', 'keydown', 'touchstart'],
  },
  {
    id: '2.5.2',
    level: 'A',
    name: 'Pointer Cancellation',
    whyManual: 'Requires interaction testing to confirm pointer actions can be cancelled or complete on up/click.',
    patterns: ['pointerup', 'mouseup', 'click', 'pointercancel', 'Escape'],
  },
  {
    id: '2.5.4',
    level: 'A',
    name: 'Motion Actuation',
    whyManual: 'Requires confirming device-motion input is absent or has alternatives.',
    patterns: ['devicemotion', 'deviceorientation', 'motion', 'accelerometer', 'gyroscope'],
  },
  {
    id: '2.5.7',
    level: 'AA',
    name: 'Dragging Movements',
    whyManual: 'Requires confirming drag interactions have click/keyboard alternatives.',
    patterns: ['draggable', 'dragstart', 'dragover', 'drop', 'sortable', 'click', 'keydown'],
  },
  {
    id: '3.1.2',
    level: 'AA',
    name: 'Language of Parts',
    whyManual: 'Requires human judgment about passages in another natural language.',
    patterns: [' lang=', 'hreflang', 'language', 'German', 'Deutsch'],
  },
  {
    id: '3.2.1',
    level: 'A',
    name: 'On Focus',
    whyManual: 'Requires confirming focus does not unexpectedly change context.',
    patterns: ['focus', 'onfocus', 'addEventListener(\'focus', 'window.location', 'location.href'],
  },
  {
    id: '3.2.2',
    level: 'A',
    name: 'On Input',
    whyManual: 'Requires confirming input changes do not unexpectedly submit/navigate without warning.',
    patterns: ['change', 'input', 'submit', 'window.location', 'location.href'],
  },
  {
    id: '3.2.3',
    level: 'AA',
    name: 'Consistent Navigation',
    whyManual: 'Requires checking repeated navigation appears in a consistent relative order.',
    patterns: ['navbar', 'include navbar', '<nav', 'sebook_navbar_sidebar'],
  },
  {
    id: '3.2.4',
    level: 'AA',
    name: 'Consistent Identification',
    whyManual: 'Requires checking repeated components are named consistently across pages.',
    patterns: ['aria-label', 'title=', 'include', 'button', 'nav'],
  },
  {
    id: '3.2.6',
    level: 'A',
    name: 'Consistent Help',
    whyManual: 'Requires confirming help/contact mechanisms, if provided, appear consistently.',
    patterns: ['help', 'contact', 'mailto:', 'footer', 'cookie-notice'],
  },
  {
    id: '3.3.1',
    level: 'A',
    name: 'Error Identification',
    whyManual: 'Requires exercising form and tutorial validation errors.',
    patterns: ['error', 'invalid', 'aria-invalid', 'setCustomValidity', 'throw new Error'],
  },
  {
    id: '3.3.3',
    level: 'AA',
    name: 'Error Suggestion',
    whyManual: 'Requires reviewing whether error messages suggest corrections when possible.',
    patterns: ['hint', 'suggest', 'feedback', 'notice', 'explanation', 'error'],
  },
  {
    id: '3.3.4',
    level: 'AA',
    name: 'Error Prevention (Legal, Financial, Data)',
    whyManual: 'Requires product judgment about whether legal, financial, or user-data submissions exist.',
    patterns: ['confirm(', 'delete', 'review', 'submit', 'form'],
  },
  {
    id: '3.3.7',
    level: 'A',
    name: 'Redundant Entry',
    whyManual: 'Requires flow review for repeated user-entered information.',
    patterns: ['autocomplete', 'localStorage', 'sessionStorage', 'saved', 'restore'],
  },
  {
    id: '3.3.8',
    level: 'AA',
    name: 'Accessible Authentication (Minimum)',
    whyManual: 'Requires confirming authentication, if any, does not rely on cognitive function tests.',
    patterns: ['login', 'password', 'auth', 'captcha', 'authenticate'],
  },
  {
    id: '4.1.3',
    level: 'AA',
    name: 'Status Messages',
    whyManual: 'Requires exercising dynamic updates to confirm they are announced without moving focus.',
    patterns: ['role="status"', 'aria-live', 'role="alert"', 'status', 'toast'],
  },
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (EXCLUDED_DIRS.has(entry.name)) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (!entry.isFile()) return [];
    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [full] : [];
  });
}

function findEvidence(patterns, files) {
  const needles = patterns.map((pattern) => pattern.toLowerCase());
  const matches = [];
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      const lower = line.toLowerCase();
      const matched = needles.find((needle) => lower.includes(needle));
      if (!matched) return;
      matches.push({
        file: rel,
        line: index + 1,
        pattern: patterns[needles.indexOf(matched)],
        excerpt: line.trim().slice(0, 220),
      });
    });
  }
  return matches.slice(0, 40);
}

test('WCAG 2.2 AA manual criteria have source implementation evidence sweep', async () => {
  const files = walk(ROOT);
  const criteria = MANUAL_OR_FLOW_CRITERIA.map((criterion) => {
    const evidence = findEvidence(criterion.patterns, files);
    return {
      ...criterion,
      manualOrFlowVerificationStillRequired: true,
      sourceEvidenceStatus: evidence.length ? 'source-evidence-found' : 'no-source-evidence-found',
      evidence,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    conformanceTarget: 'WCAG 2.2 AA',
    scope: {
      filesScanned: files.length,
      criteriaSwept: criteria.length,
      excludedDirectories: [...EXCLUDED_DIRS],
      sourceExtensions: [...SOURCE_EXTENSIONS],
    },
    criteria,
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`WCAG 2.2 source implementation sweep written to ${REPORT_PATH}`);
  console.log(`Manual/flow criteria swept: ${criteria.length}`);
  console.log(`No source evidence found: ${criteria.filter((criterion) => criterion.sourceEvidenceStatus === 'no-source-evidence-found').length}`);

  expect(criteria).toHaveLength(MANUAL_OR_FLOW_CRITERIA.length);
});
