'use strict';

// The interface description card (spec §6.6 "Interface description card", J11): `interface <id>` views are drawn
// as semantic HTML, not as an image. The card reads in the order of the spec's groups, keeps a field's number and
// unit in one table row, prints what is missing, honours `# panels: syntax`, escapes every author text, and is the
// same markup whether the page draws it or the static build prerenders it.

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');

const REPO_ROOT = path.join(__dirname, '../..');
const ARCHUML = path.join(REPO_ROOT, 'js/ArchUML');
const FIXTURES = path.join(ARCHUML, 'tests/c4/fixtures');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'c4/manifest.json'), 'utf8'));
const REGISTRATION = fs.readFileSync(path.join(FIXTURES, 'course-registration-interfaces.yml'), 'utf8');
const SHOP = fs.readFileSync(path.join(FIXTURES, 'interfaces-shop.yml'), 'utf8');
const HARNESS_PATH = path.join(__dirname, 'fixtures', 'uml-static-harness.rb');

const ENROLLMENT_CARD = 'interface enrollment-api';
const GROUPS_IN_ORDER = ['Syntactic view', 'Semantic view', 'Data types', 'Shared vocabulary'];

/** An embed of `model` that shows `selector`, preceded by its directive comment lines. */
function embed(model, selector, directives = []) {
  return directives.concat(`view: ${selector}`, model).join('\n');
}

/** `text` with `from` replaced by `to`; fails loudly when the fixture no longer contains `from`. */
function edited(text, from, to) {
  assert.ok(text.includes(from), `the fixture contains ${JSON.stringify(from)}`);
  return text.replace(from, to);
}

let browser;
let page;
before(async () => {
  browser = await chromium.launch(chromiumLaunchOptions());
  page = await browser.newPage();
  await page.setContent('<!doctype html><html lang="en"><title>C4 interface card test</title><body></body></html>');
  await page.addScriptTag({ path: path.join(ARCHUML, 'uml-bundle.js') });
  for (const file of MANIFEST.core.concat(MANIFEST.render)) {
    await page.addScriptTag({ path: path.join(ARCHUML, file) });
  }
});
after(async () => { if (browser) await browser.close(); });

/**
 * Renders `text` into a fresh figure container, labelled as the bundle's figure builder labels every container
 * before it renders (`role="img"` with a fallback caption), and returns that container.
 */
async function renderFigure(text) {
  await page.evaluate((source) => {
    const figure = document.createElement('figure');
    const container = document.createElement('div');
    container.id = 'figure-container';
    container.setAttribute('role', 'img');
    container.setAttribute('aria-label', 'C4 model diagram');
    figure.append(container);
    document.body.replaceChildren(figure);
    window.ArchUMLC4Render.render(container, source);
  }, text);
  return page.locator('#figure-container');
}

/**
 * The names of the groups directly inside an article or group, in reading order, from its accessibility snapshot
 * (YAML, which single-quotes a line whose name holds a colon).
 */
function childGroupNames(snapshot) {
  return [...snapshot.matchAll(/^ {2}- '?group "([^"]*)"/gm)].map((match) => match[1].replace(/''/g, "'"));
}

test('the card is an article with labelled groups, not an image', async () => {
  const container = await renderFigure(embed(REGISTRATION, ENROLLMENT_CARD));

  assert.equal(await container.getAttribute('role'), null, 'a card is text, not an image');
  assert.equal(await container.getAttribute('aria-label'), null);
  assert.equal(await container.getAttribute('data-c4-notation'), 'interface-card');
  const article = page.getByRole('article', { name: 'Enrollment API', exact: true });
  assert.equal(await article.count(), 1);
  assert.deepEqual(childGroupNames(await article.ariaSnapshot()), GROUPS_IN_ORDER);
  for (const line of [
    'REST interface · JSON/HTTPS · version 1',
    'Provided by Registration API (Container: Python, FastAPI)',
    'Handled inside Registration API by Registration Coordinator (submit-plan)',
  ]) {
    assert.equal(await article.getByText(line, { exact: true }).count(), 1, `the header line "${line}"`);
  }
});

test('operations and their semantics read in order', async () => {
  await renderFigure(embed(REGISTRATION, ENROLLMENT_CARD));
  const article = page.getByRole('article', { name: 'Enrollment API', exact: true });

  const syntactic = article.getByRole('group', { name: 'Syntactic view', exact: true });
  const syntaxList = syntactic.locator('dl').filter({ has: page.locator('code', { hasText: /^POST \/v1\/enrollments$/ }) });
  assert.equal(await syntaxList.count(), 1, 'the operation is a description list whose syntax is code');

  const semantic = article.getByRole('group', { name: 'Semantic view', exact: true });
  assert.deepEqual(childGroupNames(await semantic.ariaSnapshot()), ['All operations', 'submit-plan: POST /v1/enrollments']);
  const allOperations = semantic.getByRole('group', { name: 'All operations', exact: true });
  assert.match(await allOperations.innerText(), /unauthorized \(401\): the caller is not signed in as the student named in the request/);
  const operation = semantic.getByRole('group', { name: 'submit-plan: POST /v1/enrollments', exact: true });
  assert.match(await operation.innerText(), /Realizes: DECIDE whether a student may enroll in a section \(Registration API\)/);
  const examples = operation.getByRole('listitem').filter({ hasText: 'units_enrolled: 8' });
  assert.equal(await examples.count(), 1, 'one example shows the output with its units');
  assert.match(await examples.innerText(), /^Input \{student_id: "905123456", .*\} → Output \{status: enrolled, units_enrolled: 8, .*\}\. Two 4-unit sections that do not clash\.$/);
});

test('each type is a table whose rows keep a number with its unit', async () => {
  await renderFigure(embed(REGISTRATION, ENROLLMENT_CARD));
  const types = page.getByRole('group', { name: 'Data types', exact: true });

  const table = types.getByRole('table', { name: /^EnrollmentOutcome/ });
  assert.equal(await table.count(), 1);
  assert.match(await table.locator('caption').innerText(), /^EnrollmentOutcome/);
  const syntacticHeader = table.getByRole('columnheader', { name: 'Syntactic view', exact: true });
  const semanticHeader = table.getByRole('columnheader', { name: 'Semantic view', exact: true });
  assert.deepEqual([await syntacticHeader.getAttribute('colspan'), await syntacticHeader.getAttribute('scope')], ['5', 'colgroup']);
  assert.deepEqual([await semanticHeader.getAttribute('colspan'), await semanticHeader.getAttribute('scope')], ['3', 'colgroup']);
  const unitsRow = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'units_enrolled', exact: true }) });
  assert.deepEqual(await unitsRow.locator('th, td').allInnerTexts(), [
    'units_enrolled', 'number', 'required', '', '', 'total units the student holds in the term after this attempt', 'quarter units', '',
  ]);

  const region = types.getByRole('region', { name: /^EnrollmentOutcome/ });
  assert.equal(await region.getAttribute('tabindex'), '0', 'the table scrolls by keyboard');
  assert.equal(await region.getByRole('table').count(), 1);
});

test('the syntax-only option hides the semantics without absence lines', async () => {
  const container = await renderFigure(embed(REGISTRATION, ENROLLMENT_CARD, ['# panels: syntax']));
  const article = page.getByRole('article', { name: 'Enrollment API', exact: true });

  assert.equal(await container.getAttribute('data-c4-panels'), 'syntax');
  assert.deepEqual(childGroupNames(await article.ariaSnapshot()), ['Syntactic view', 'Data types']);
  const columnsPerRow = await article.getByRole('table').evaluateAll((tables) => tables.flatMap((table) =>
    [...table.rows].map((row) => [...row.cells].reduce((columns, cell) => columns + cell.colSpan, 0))));
  assert.ok(columnsPerRow.length > 0);
  assert.deepEqual([...new Set(columnsPerRow)], [5], 'every row of every table has the five syntactic columns');
  assert.doesNotMatch(await article.innerText(), /not stated/);
});

test('missing semantics are printed', async () => {
  await renderFigure(embed(SHOP, 'interface card-payments'));
  const refund = page.getByRole('article', { name: 'Card Payments API', exact: true })
    .getByRole('group', { name: 'refund: POST /v3/refunds', exact: true });
  const refundText = await refund.innerText();
  assert.match(refundText, /Purpose: not stated\./);
  assert.match(refundText, /Errors: none stated\./);

  await renderFigure(embed(SHOP, 'interface app'));
  const semantic = page.getByRole('article', { name: 'Shop App interface', exact: true })
    .getByRole('group', { name: 'Semantic view', exact: true });
  assert.match(await semantic.innerText(), /Semantic view: not described yet\./);
});

test('user text cannot inject markup', async () => {
  const hostile = '<img src=x onerror=alert(1)>';
  const model = edited(REGISTRATION,
    'description: Enrolls one student in every section of a planned schedule, or in none.',
    `description: '${hostile}'`);
  await renderFigure(embed(model, ENROLLMENT_CARD));
  const article = page.getByRole('article', { name: 'Enrollment API', exact: true });

  assert.equal(await article.getByText(hostile, { exact: true }).count(), 1, 'the description is shown as text');
  assert.equal(await page.locator('#figure-container img').count(), 0, 'no element is created from the text');
});

test('no style attributes are emitted', async () => {
  for (const [model, selector] of [[REGISTRATION, ENROLLMENT_CARD], [SHOP, 'interface card-payments'], [SHOP, 'interface app']]) {
    for (const directives of [[], ['# panels: syntax']]) {
      await renderFigure(embed(model, selector, directives));
      assert.equal(await page.locator('#figure-container article[style], #figure-container article [style]').count(), 0,
        `${selector} ${directives.join(' ')} has no style attribute`);
    }
  }
});

test('the card markup is built without a DOM', () => {
  const core = require('../../js/ArchUML/c4/c4-core.js');
  const renderer = require('../../js/ArchUML/c4/c4-render.js');
  const viewModel = core.project(core.load(REGISTRATION), ENROLLMENT_CARD);

  const markup = renderer.cardMarkup(viewModel, { idPrefix: 'card' });
  assert.match(markup, /^<article class="c4-interface" data-c4-interface="enrollment-api" aria-labelledby="card-name">/);
  assert.match(markup, /<\/article>$/);
});

/** The ids a card drawn into a container with id `containerId` (none when null) writes, after `before` other cards. */
async function cardIds(text, { containerId, before = [] }) {
  return page.evaluate(([source, id, earlier]) => {
    document.body.replaceChildren();
    for (const other of earlier) window.ArchUMLC4Render.render(document.body.appendChild(document.createElement('div')), other);
    const container = document.body.appendChild(document.createElement('div'));
    if (id) container.id = id;
    window.ArchUMLC4Render.render(container, source);
    return [...container.querySelectorAll('[id]')].map((element) => element.id);
  }, [text, containerId, before]);
}

test('card ids do not depend on how many cards were drawn before', async () => {
  const text = embed(REGISTRATION, ENROLLMENT_CARD);
  const alone = await cardIds(text, {});
  const afterOthers = await cardIds(text, { before: [embed(SHOP, 'interface orders-api'), embed(REGISTRATION, ENROLLMENT_CARD, ['# panels: syntax'])] });
  assert.ok(alone.length > 3, 'the card writes ids');
  assert.deepEqual(afterOthers, alone);
});

test('a card in a container with an id takes its ids from the container', async () => {
  const ids = await cardIds(embed(REGISTRATION, ENROLLMENT_CARD), { containerId: 'enrollment-figure' });
  assert.ok(ids.length > 3, 'the card writes ids');
  assert.deepEqual(ids.filter((id) => !id.startsWith('enrollment-figure-')), []);
});

test('two cards of one page never share an id, whatever their panels', async () => {
  const ids = await page.evaluate((sources) => {
    document.body.replaceChildren();
    for (const source of sources) window.ArchUMLC4Render.render(document.body.appendChild(document.createElement('div')), source);
    return [...document.querySelectorAll('[id]')].map((element) => element.id);
  }, [embed(REGISTRATION, ENROLLMENT_CARD), embed(REGISTRATION, ENROLLMENT_CARD, ['# panels: syntax']), embed(REGISTRATION, ENROLLMENT_CARD)]);
  assert.equal(new Set(ids).size, ids.length, `duplicate ids among ${ids.join(', ')}`);
});

// ---- Static prerender (spec §6.6 "Static prerender", Ruling 19) --------------------------------------------------

/** What the static driver (js/ArchUML/uml_to_svg.js) returns for a C4 embed, as the Jekyll build calls it. */
function prerendered(text) {
  const stdout = execFileSync('node', [path.join(ARCHUML, 'uml_to_svg.js')], {
    cwd: REPO_ROOT, encoding: 'utf8', input: JSON.stringify({ figure: { type: 'c4', text } }), maxBuffer: 16 * 1024 * 1024,
  });
  return JSON.parse(stdout).figure;
}

/** The page the static plugin builds around `markup` for one fenced C4 block of `text`. */
function staticPage(text, markup) {
  const fence = `<pre><code class="language-c4">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
  const stdout = execFileSync('ruby', [HARNESS_PATH], {
    encoding: 'utf8',
    input: JSON.stringify({ operation: 'process_cached_svg', content: `<main>${fence}</main>`, svg: markup, page_identifier: '/card.html' }),
    maxBuffer: 16 * 1024 * 1024,
  });
  return JSON.parse(stdout).html;
}

/** `markup` with every id, and every reference to one, replaced by its order of first appearance. */
function withNumberedIds(markup) {
  const numbers = new Map();
  for (const match of markup.matchAll(/\bid="([^"]+)"/g)) numbers.set(match[1], `id-${numbers.size + 1}`);
  return markup.replace(/\b(id|aria-labelledby)="([^"]+)"/g, (whole, name, value) =>
    `${name}="${value.split(/\s+/).map((id) => numbers.get(id) || id).join(' ')}"`);
}

const ARTICLE_PATTERN = /<article\b[\s\S]*<\/article>/;

test('the live and the static markup are equal', async () => {
  for (const directives of [[], ['# panels: syntax']]) {
    const text = embed(REGISTRATION, ENROLLMENT_CARD, directives);
    await renderFigure(text);
    const live = await page.locator('#figure-container article').evaluate((article) => article.outerHTML);
    const staticArticle = staticPage(text, prerendered(text)).match(ARTICLE_PATTERN);

    assert.ok(staticArticle, 'the static page carries the card');
    assert.equal(withNumberedIds(staticArticle[0]), withNumberedIds(live), `panels: ${directives.join(' ') || 'all'}`);
  }
});
