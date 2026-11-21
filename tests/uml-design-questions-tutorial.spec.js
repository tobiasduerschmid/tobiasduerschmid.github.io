// @ts-check
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { loadTutorialConfig } = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

// "Answering Design Questions with UML" (CS 130), as a student works through
// it: the warm-up, five code-first diagram challenges on the Headliner
// codebase, and the plan-first capstone with its results card, then the
// print view. Answer keys, evidence lines, and labels come from the tutorial
// YAML and facts.json at test time, so rewording a question or an option does
// not break the test; only a change to what is correct does.

const PAGE = '/SEBook/tools/uml-design-questions';
const BOOT_TIMEOUT = 120_000;
const config = loadTutorialConfig('uml-design-questions');
const facts = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '..', 'tutorial_sources', 'uml-design-questions', 'facts.json'), 'utf8'));

const steps = config.steps;
const challengeSteps = steps.filter(step => step.diagram_challenge);
const codeFirstSteps = challengeSteps.filter(step => step.diagram_challenge.mode !== 'plan-first');
const stepByKey = key => steps.find(step => step.key === key);
const sharedFileLines = filePath => config.shared_files.find(file => file.path === filePath).content.split('\n');

// The widget's names for the views a student can ask for.
const VIEW_LABELS = { class: 'Class diagram', component: 'Component diagram', sequence: 'Sequence diagram' };

/** Visible text of one line of Markdown (code spans and bold, as rendered). */
function plain(markdown) {
  return String(markdown).replace(/`/g, '').replace(/\*\*(.+?)\*\*/g, '$1').trim();
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A pattern for Markdown's visible text; kramdown may curl its quotes. */
function textPattern(markdown) {
  return escapeRegExp(plain(markdown)).replace(/['‘’]/g, "['‘’]").replace(/["“”]/g, '["“”]');
}

function keyIndices(question) {
  return question.type === 'multiple' ? question.correct_indices : [question.correct_index];
}

function wrongIndex(question) {
  const keys = keyIndices(question);
  return question.options.findIndex((_, index) => !keys.includes(index));
}

function parseRef(ref) {
  const [, filePath, line] = /^(.*):(\d+)$/.exec(ref);
  return { path: filePath, line: Number(line) };
}

// ---------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------

/** The workspace stays hidden while it boots, so Run appears once it is ready. */
async function waitForBoot(page) {
  await expect(runButton(page)).toBeEnabled({ timeout: BOOT_TIMEOUT });
}

function runButton(page) {
  return page.getByRole('button', { name: /^▶\s*Run$/ });
}

function programOutput(page) {
  return page.getByRole('region', { name: 'Program output', exact: true });
}

function codeEditor(page) {
  return page.getByRole('textbox', { name: /code editor/ }).first();
}

function fileTree(page) {
  return page.getByRole('tree', { name: 'Files' });
}

function treeItem(page, name) {
  return fileTree(page).getByRole('treeitem', { name, exact: true });
}

function fileTab(page, filePath) {
  return page.getByRole('group', { name: /^File tabs/ }).getByRole('button', { name: filePath, exact: true });
}

// A locked Next button also shows a lock icon in its name.
function nextButton(page) {
  return page.getByRole('button', { name: /^Next →/ });
}

function stepHeading(page, step) {
  return page.getByRole('heading', { name: step.title, level: 2 });
}

/** The editor's file and cursor line, as "Pin this line" records them. */
function editorLocation(page) {
  return page.evaluate(() => window._tutorial.currentEditorLocation());
}

function searchResult(page, filePath, line) {
  return page.getByRole('list', { name: 'Search results' })
    .getByRole('list', { name: new RegExp('^' + escapeRegExp(filePath) + ' \\d+ results?$') })
    .getByRole('button', { name: new RegExp('^Line ' + line + '(?!\\d)') });
}

/** Ctrl/Cmd+Shift+F from inside the tutorial, then search for `text`. */
async function search(page, text) {
  await page.keyboard.press('ControlOrMeta+Shift+F');
  const field = page.getByLabel('Search all files', { exact: true });
  await expect(field).toBeFocused();
  await field.fill(text);
}

// ---------------------------------------------------------------------------
// Challenge helpers
// ---------------------------------------------------------------------------

function challenge(page) {
  return page.getByRole('region', { name: 'Diagram challenge', exact: true });
}

/** A stage of the challenge: 'Answer from the code', 'The agent’s reply', … */
function stage(page, name) {
  return challenge(page).getByRole('region', { name, exact: true });
}

function numberedGroup(scope, number) {
  return scope.getByRole('group', { name: new RegExp(`^Question ${number}:`) });
}

/** A lone question's legend is its stem. */
function stemGroup(scope, question) {
  return scope.getByRole('group', { name: new RegExp('^' + textPattern(question.question)) });
}

/** Options keep their authored order in the widget (they are never shuffled). */
function optionsOf(group, question) {
  return group.getByRole(question.type === 'multiple' ? 'checkbox' : 'radio');
}

async function choose(group, question, indices) {
  const options = optionsOf(group, question);
  if (question.type === 'multiple') {
    for (let index = 0; index < question.options.length; index++) await options.nth(index).setChecked(indices.includes(index));
  } else {
    await options.nth(indices[0]).check();
  }
}

async function expectChosen(group, question, indices) {
  const options = optionsOf(group, question);
  for (let index = 0; index < question.options.length; index++) {
    if (indices.includes(index)) await expect(options.nth(index)).toBeChecked();
    else await expect(options.nth(index)).not.toBeChecked();
  }
}

/** Open the file through the Files tree, go to the line, and pin it. */
async function pinThroughTree(page, fromCode, ref) {
  const { path: filePath, line } = parseRef(ref);
  const segments = filePath.split('/');
  let scope = fileTree(page);
  for (const folder of segments.slice(0, -1)) {
    scope = scope.getByRole('treeitem', { name: folder, exact: true });
    // Right expands a closed folder; on an open one it only moves inside.
    await scope.focus();
    await page.keyboard.press('ArrowRight');
    await expect(scope).toHaveAttribute('aria-expanded', 'true');
  }
  await scope.getByRole('treeitem', { name: segments[segments.length - 1], exact: true }).click();
  await expect(fileTab(page, filePath)).toHaveAttribute('aria-current', 'true');
  await codeEditor(page).focus();
  await page.keyboard.press('Control+G'); // Monaco's Go to Line
  await page.keyboard.type(String(line));
  await page.keyboard.press('Enter');
  await expect.poll(() => editorLocation(page)).toEqual({ path: filePath, line });
  await fromCode.getByRole('button', { name: 'Pin this line' }).click();
  await expect(fromCode.getByRole('button', { name: `${filePath}:${line}`, exact: true })).toBeVisible();
}

/** Find the line by searching for its text, open the result, and pin it. */
async function pinThroughSearch(page, fromCode, ref) {
  const { path: filePath, line } = parseRef(ref);
  await search(page, sharedFileLines(filePath)[line - 1].trim());
  await searchResult(page, filePath, line).click();
  await expect(codeEditor(page)).toBeFocused();
  await fromCode.getByRole('button', { name: 'Pin this line' }).click();
  await expect(fromCode.getByRole('button', { name: `${filePath}:${line}`, exact: true })).toBeVisible();
}

/** Two evidence lines in different files, from the reply's own evidence. */
function pinRefs(challengeSpec) {
  const refs = challengeSpec.reply.evidence.map(item => item.ref);
  const searchRef = refs[0];
  const treeRef = refs.find(ref => parseRef(ref).path !== parseRef(searchRef).path);
  return { treeRef, searchRef };
}

async function writeAttempt(page, step) {
  const fromCode = stage(page, 'Answer from the code');
  await fromCode.getByLabel('Your hypothesis, in one sentence').fill(`My hypothesis for ${step.title}.`);
  const { treeRef, searchRef } = pinRefs(step.diagram_challenge);
  await pinThroughTree(page, fromCode, treeRef);
  await pinThroughSearch(page, fromCode, searchRef);
  await fromCode.getByLabel('What would you want a diagram of this code to show?').fill('The pieces this question depends on, side by side.');
}

/** Part A answers: a wrong first choice, then the key, the confidence, and the view. */
async function answerFromCode(page, step) {
  const challengeSpec = step.diagram_challenge;
  const fromCode = stage(page, 'Answer from the code');
  for (const [index, question] of challengeSpec.questions.entries()) {
    const group = numberedGroup(fromCode, index + 1);
    await choose(group, question, [wrongIndex(question)]);
    await choose(group, question, keyIndices(question));
  }
  await fromCode.getByLabel('Fairly sure', { exact: true }).check();
  if (challengeSpec.predict_view) {
    await fromCode.getByRole('group', { name: 'Which view would you ask the agent for?' })
      .getByLabel(VIEW_LABELS[challengeSpec.reply.diagrams[0].type], { exact: true }).check();
  }
  await expect(fromCode.getByText('Everything is answered. Lock in when you are ready.')).toBeVisible();
}

async function lockIn(page, label) {
  await challenge(page).getByRole('button', { name: label, exact: true }).click();
  await page.getByRole('dialog', { name: 'Lock in your answer?' }).getByRole('button', { name: 'Lock in', exact: true }).click();
  await expect(stage(page, 'The agent’s reply').getByRole('heading', { name: 'The agent’s reply' })).toBeFocused();
}

function diagramRegion(page, type) {
  return page.getByRole('region', { name: new RegExp('^UML ' + type + ' diagram', 'i') });
}

/** An evidence note opens its file at its line, beside the diagram. */
async function openEvidence(page, challengeSpec) {
  const ref = challengeSpec.reply.evidence[0].ref;
  const { path: filePath, line } = parseRef(ref);
  await stage(page, 'The agent’s reply').getByRole('button', { name: new RegExp(escapeRegExp(ref) + '$') }).click();
  await expect(fileTab(page, filePath)).toHaveAttribute('aria-current', 'true');
  await expect.poll(() => editorLocation(page)).toEqual({ path: filePath, line });
  await expect(codeEditor(page)).toBeVisible();
  await expect(programOutput(page)).toBeVisible();
  await expect(diagramRegion(page, challengeSpec.reply.diagrams[0].type)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Code beside diagram' })).toHaveAttribute('aria-pressed', 'true');
}

async function answerContrast(page, challengeSpec) {
  const reply = stage(page, 'The agent’s reply');
  const question = challengeSpec.reply.contrast.question;
  await choose(stemGroup(reply, question), question, keyIndices(question));
  await reply.getByRole('button', { name: 'Check my answer', exact: true }).click();
  await expect(reply.getByRole('heading', { name: 'Second reply' })).toBeFocused();
}

function checkLabel(questions) {
  return questions.length > 1 ? 'Check my answers' : 'Check my answer';
}

/** Part B; with firstWrong the first check misses question 1, then it is fixed. */
async function answerWithDiagram(page, challengeSpec, { firstWrong = false } = {}) {
  const withDiagram = stage(page, 'Answer with the diagram');
  const questions = challengeSpec.questions;
  for (const [index, question] of questions.entries()) {
    await choose(numberedGroup(withDiagram, index + 1), question, keyIndices(question));
  }
  const check = withDiagram.getByRole('button', { name: checkLabel(questions), exact: true });
  if (firstWrong) {
    await choose(numberedGroup(withDiagram, 1), questions[0], [wrongIndex(questions[0])]);
    await check.click();
    await expect(numberedGroup(withDiagram, 1).getByText('Not correct yet')).toBeVisible();
    await choose(numberedGroup(withDiagram, 1), questions[0], keyIndices(questions[0]));
    await expect(numberedGroup(withDiagram, 1).getByText('Changed since your last check')).toBeVisible();
  }
  await check.click();
  await expect(withDiagram.getByRole('heading', { name: `${questions.length} of ${questions.length} correct` })).toBeFocused();
  await withDiagram.getByRole('button', { name: 'Continue to the new question' }).click();
  await expect(stage(page, 'A new question').getByRole('heading', { name: 'A new question' })).toBeFocused();
}

/** The new questions, then (when there is one) the evidence check. */
async function answerFollowUpAndEvidence(page, challengeSpec) {
  const followUp = stage(page, 'A new question');
  // Several new questions are numbered; a lone one is named by its stem.
  for (const [index, question] of challengeSpec.follow_up.entries()) {
    const field = challengeSpec.follow_up.length > 1 ? numberedGroup(followUp, index + 1) : stemGroup(followUp, question);
    await choose(field, question, keyIndices(question));
  }
  await followUp.getByRole('button', { name: checkLabel(challengeSpec.follow_up), exact: true }).click();
  await expect(followUp.getByText(`${challengeSpec.follow_up.length} of ${challengeSpec.follow_up.length} correct`)).toBeVisible();
  const evidenceCheck = challengeSpec.evidence_check;
  if (evidenceCheck) {
    const questions = [evidenceCheck.claim_question, evidenceCheck.question].filter(Boolean);
    const group = followUp.getByRole('group', { name: 'Check the diagram against the code' });
    for (const [index, question] of questions.entries()) {
      const field = questions.length > 1 ? numberedGroup(group, index + 1) : stemGroup(group, question);
      await choose(field, question, keyIndices(question));
    }
    await group.getByRole('button', { name: checkLabel(questions), exact: true }).click();
    await expect(group.getByText(`${questions.length} of ${questions.length} correct`)).toBeVisible();
  }
  await followUp.getByRole('button', { name: 'Show the comparison' }).click();
  await expect(stage(page, 'Compare your answers').getByRole('heading', { name: 'Compare your answers' })).toBeFocused();
}

async function finishChallenge(page, challengeSpec) {
  const compare = stage(page, 'Compare your answers');
  const debrief = challengeSpec.debrief;
  await compare.getByLabel(new RegExp('^' + textPattern(debrief.consolidation_prompt) + '$'))
    .fill('The view put each relation I had searched for next to the others.');
  await choose(stemGroup(compare, debrief.mechanism_question), debrief.mechanism_question, keyIndices(debrief.mechanism_question));
  await compare.getByRole('button', { name: 'Finish the challenge' }).click();
  await expect(compare.getByText(/^Challenge complete with a score of 100%/)).toBeVisible();
}

// ---------------------------------------------------------------------------
// Knowledge checks (their questions and options shuffle)
// ---------------------------------------------------------------------------

/** A knowledge-check option's name: its letter, then its text. */
function quizOptionName(markdown) {
  return new RegExp('^[A-Z] ' + textPattern(markdown) + '$');
}

/** The shown question's options (the other questions' cards are hidden). */
function quizAnswers(page) {
  return page.getByRole('radiogroup', { name: 'Answer options' }).or(page.getByRole('group', { name: 'Answer options' }));
}

/** The YAML question on screen: the one whose options are all shown. */
async function shownQuizQuestion(page, questions) {
  await expect(quizAnswers(page)).toBeVisible();
  for (const question of questions) {
    const role = question.type === 'multiple' ? 'checkbox' : 'radio';
    let shown = 0;
    for (const option of question.options) shown += await quizAnswers(page).getByRole(role, { name: quizOptionName(option) }).count();
    if (shown === question.options.length) return question;
  }
  throw new Error('No knowledge-check question from the YAML is on screen');
}

async function passKnowledgeCheck(page, quiz, nextStepNumber) {
  const remaining = [...quiz.questions];
  while (remaining.length) {
    const question = await shownQuizQuestion(page, remaining);
    remaining.splice(remaining.indexOf(question), 1);
    const role = question.type === 'multiple' ? 'checkbox' : 'radio';
    for (const index of keyIndices(question)) {
      await quizAnswers(page).getByRole(role, { name: quizOptionName(question.options[index]) }).click();
    }
    if (question.type === 'multiple') await page.getByRole('button', { name: 'Submit Answer' }).click();
    await page.getByRole('button', { name: remaining.length ? 'Next Question' : 'See Results' }).click();
  }
  await page.getByRole('button', { name: `Continue to Step ${nextStepNumber} →` }).click();
}

/** Next from a passed step: through its knowledge check when it has one. */
async function continueToNextStep(page, step) {
  const index = steps.indexOf(step);
  await expect(nextButton(page)).toBeEnabled();
  await nextButton(page).click();
  if (step.quiz) await passKnowledgeCheck(page, step.quiz, index + 2);
  await expect(stepHeading(page, steps[index + 1])).toBeVisible();
}

// ---------------------------------------------------------------------------
// The whole tutorial, in order. Each test continues where the previous one
// stopped (one page, saved progress), because the results card and the
// print view read the records the earlier challenges left.
// ---------------------------------------------------------------------------

test.describe('the whole tutorial, as a student', () => {
  test.describe.configure({ mode: 'serial' });

  /** @type {import('@playwright/test').Page} */
  let page;
  const errors = [];
  // axe fetches @import-ed stylesheets against the page's URL and logs 404s
  // for them; those requests are the audit's, not the tutorial's.
  let auditing = false;

  test.beforeAll(async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      viewport: { width: 1440, height: 900 },
    });
    page = await context.newPage();
    page.on('console', message => { if (message.type() === 'error' && !auditing) errors.push(message.text()); });
    page.on('pageerror', error => errors.push(error.message));
  });

  /** An accessibility checkpoint (when enabled) for the current state. */
  async function audit(label) {
    auditing = true;
    try {
      await a11yCheckpoint(page, `uml-design-questions: ${label}`, { feature: 'diagram-challenge' });
    } finally {
      auditing = false;
    }
  }

  test.afterAll(async () => {
    await page.context().close();
  });

  async function reload() {
    await page.reload();
    await waitForBoot(page);
  }

  test('the warm-up knowledge check opens the first challenge', async () => {
    await page.goto(PAGE);
    await waitForBoot(page);
    await expect(stepHeading(page, steps[0])).toBeVisible();
    await continueToNextStep(page, steps[0]);
  });

  test('Event Consumers: every challenge state survives a reload', async () => {
    test.setTimeout(240_000);
    const step = stepByKey('event-consumers');
    const challengeSpec = step.diagram_challenge;
    const fromCode = () => stage(page, 'Answer from the code');
    const firstQuestion = challengeSpec.questions[0];
    await expect(page.getByRole('button', { name: 'Diagram', exact: true })).toHaveAttribute('aria-disabled', 'true');

    // Exploring, with a draft.
    await writeAttempt(page, step);
    await choose(numberedGroup(fromCode(), 1), firstQuestion, [wrongIndex(firstQuestion)]);
    await reload();
    await expect(fromCode().getByLabel('Your hypothesis, in one sentence')).toHaveValue(`My hypothesis for ${step.title}.`);
    for (const ref of Object.values(pinRefs(challengeSpec))) {
      await expect(fromCode().getByRole('button', { name: ref, exact: true })).toBeVisible();
    }
    await expectChosen(numberedGroup(fromCode(), 1), firstQuestion, [wrongIndex(firstQuestion)]);
    await audit('exploring');

    // Locked: part A is read-only, the reply and the diagram stay available.
    await answerFromCode(page, step);
    await lockIn(page, 'Lock in my answer');
    await expect(diagramRegion(page, 'component')).toBeVisible();
    await expect(fileTree(page)).toBeHidden();
    await expect(programOutput(page)).toBeHidden();
    await audit('locked, maximized diagram');
    await reload();
    await expect(stage(page, 'The agent’s reply')).toBeVisible();
    await expect(fromCode().getByRole('button', { name: 'Lock in my answer' })).toBeHidden();
    await expectChosen(numberedGroup(fromCode(), 1), firstQuestion, keyIndices(firstQuestion));
    await expect(optionsOf(numberedGroup(fromCode(), 1), firstQuestion).first()).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Diagram', exact: true })).not.toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('button', { name: 'Diagram', exact: true }).click();
    await expect(diagramRegion(page, 'component')).toBeVisible();
    await openEvidence(page, challengeSpec);
    await audit('code beside the diagram');

    // Follow-up.
    await answerWithDiagram(page, challengeSpec, { firstWrong: true });
    await reload();
    await expect(stage(page, 'A new question')).toBeVisible();
    await expect(numberedGroup(stage(page, 'Answer with the diagram'), 1).getByText('Correct', { exact: true })).toBeVisible();

    // Done.
    await answerFollowUpAndEvidence(page, challengeSpec);
    await expect(nextButton(page)).toBeDisabled();
    await finishChallenge(page, challengeSpec);
    await reload();
    await expect(stage(page, 'Compare your answers').getByText('You completed this challenge. Further checks are practice.')).toBeVisible();
    await continueToNextStep(page, step);
  });

  /** One code-first challenge from the code to the comparison. */
  async function completeCodeFirst(key, { runFirst } = {}) {
    const step = stepByKey(key);
    const challengeSpec = step.diagram_challenge;
    await expect(stepHeading(page, step)).toBeVisible();
    if (runFirst) await runFirst();
    await writeAttempt(page, step);
    await answerFromCode(page, step);
    await expect(nextButton(page)).toBeDisabled();
    await lockIn(page, 'Lock in my answer');
    await expect(optionsOf(numberedGroup(stage(page, 'Answer from the code'), 1), challengeSpec.questions[0]).first()).toBeDisabled();
    if (challengeSpec.reply.contrast) {
      await expect(diagramRegion(page, challengeSpec.reply.contrast.diagram.type)).toBeVisible();
      await expect(stage(page, 'Answer with the diagram')).toHaveCount(0);
      await answerContrast(page, challengeSpec);
    }
    await expect(diagramRegion(page, challengeSpec.reply.diagrams[0].type)).toBeVisible();
    await openEvidence(page, challengeSpec);
    await answerWithDiagram(page, challengeSpec);
    await answerFollowUpAndEvidence(page, challengeSpec);
    await finishChallenge(page, challengeSpec);
    await continueToNextStep(page, step);
  }

  test('Failure Paths: the repro script, the trace, and the evidence check', async () => {
    test.setTimeout(180_000);
    await completeCodeFirst('failed-trips', {
      runFirst: async () => {
        await runButton(page).click();
        // The repro runs to the end and prints symptoms only: the trip's
        // status, `failed`, and never the cause (no refund).
        await expect(programOutput(page)).toContainText('✓ Done', { timeout: BOOT_TIMEOUT });
        await expect(programOutput(page)).toContainText(': failed');
        await expect(programOutput(page)).not.toContainText(/refund/i);
      },
    });
  });

  test('What the Data Model Allows: a predicted view and a class diagram', async () => {
    test.setTimeout(180_000);
    await completeCodeFirst('data-model');
  });

  test('Outages: the contrast view comes first, then the component view', async () => {
    test.setTimeout(180_000);
    await completeCodeFirst('outages');
  });

  test('Latency on the Checkout Path: the repro times the checkout', async () => {
    test.setTimeout(180_000);
    await completeCodeFirst('checkout-latency', {
      runFirst: async () => {
        await runButton(page).click();
        // The repro prints the total with one decimal, as facts.json measured it.
        await expect(programOutput(page)).toContainText('✓ Done', { timeout: BOOT_TIMEOUT });
        await expect(programOutput(page)).toContainText(`${facts.checkout_latency.elapsed_seconds.toFixed(1)} s`);
      },
    });
  });

  test('The Right View: the plan, four diagrams, and the results card', async () => {
    test.setTimeout(180_000);
    const step = stepByKey('choose-the-view');
    const challengeSpec = step.diagram_challenge;
    await expect(stepHeading(page, step)).toBeVisible();
    const plan = stage(page, 'Plan your requests');
    for (const [index, entry] of challengeSpec.plan.entries()) {
      const question = { ...entry, type: 'single' };
      await choose(numberedGroup(plan, index + 1), question, [wrongIndex(question)]);
      await choose(numberedGroup(plan, index + 1), question, keyIndices(question));
    }
    await lockIn(page, 'Lock in my plan');
    const tabs = page.getByRole('tablist', { name: 'Diagrams' });
    await expect(tabs.getByRole('tab')).toHaveText(challengeSpec.reply.diagrams.map(diagram => diagram.label));
    await openEvidence(page, challengeSpec);
    await answerWithDiagram(page, challengeSpec);
    await answerFollowUpAndEvidence(page, challengeSpec);

    // One row per code-first challenge: all answered from the code (after a
    // changed first choice), the diagram's first check, and the new question.
    const compare = stage(page, 'Compare your answers');
    const table = compare.getByRole('table', { name: 'Correct answers and times for each diagram challenge' });
    await expect(table.getByRole('row')).toHaveCount(codeFirstSteps.length + 1);
    for (const codeFirst of codeFirstSteps) {
      const spec = codeFirst.diagram_challenge;
      const total = spec.questions.length;
      // Event Consumers' first check with the diagram missed question 1.
      const firstCheck = codeFirst.key === 'event-consumers' ? total - 1 : total;
      await expect(table.getByRole('row', { name: new RegExp('^' + escapeRegExp(codeFirst.title)) }).getByRole('cell')).toHaveText([
        new RegExp(`^${total} of ${total} correct\\d.* · Fairly sure$`),
        new RegExp(`^${firstCheck} of ${total} correct\\d`),
        new RegExp(`^${spec.follow_up.length} of ${spec.follow_up.length} correct\\d`),
        new RegExp('^' + textPattern(spec.debrief.hidden_by) + '$'),
      ]);
    }
    await audit('results card');
    await finishChallenge(page, challengeSpec);
    await expect(nextButton(page)).toBeHidden();
  });

  test('the print view renders every diagram and keeps the keys hidden', async () => {
    await page.goto(PAGE + '/print');
    const blocks = page.getByRole('region', { name: 'Diagram challenge', exact: true });
    await expect(blocks).toHaveCount(challengeSteps.length);
    for (const [index, step] of challengeSteps.entries()) {
      const reply = step.diagram_challenge.reply;
      const block = blocks.nth(index);
      await expect(block.getByRole('heading', { name: 'Shown after you lock in' })).toBeVisible();
      await expect(block.getByRole('img', { name: /^UML \w+ diagram/i }))
        .toHaveCount(reply.diagrams.length + (reply.contrast ? 1 : 0));
      await expect(block.getByRole('heading', { name: 'Diagram challenge key', includeHidden: true })).toBeHidden();
    }
    const results = page.getByRole('region', { name: 'Your results across the challenges' });
    for (const codeFirst of codeFirstSteps) {
      await expect(results.getByRole('row', { name: new RegExp('^' + escapeRegExp(codeFirst.title)) })).toBeVisible();
    }
  });

  test('no console errors along the way', async () => {
    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Review focus: timing, keyboard-only use, reflow
// ---------------------------------------------------------------------------

const EVENT_CONSUMERS = stepByKey('event-consumers');

async function openEventConsumers(page) {
  await page.goto(PAGE + '?autosave=false#event-consumers');
  await waitForBoot(page);
  await expect(stepHeading(page, EVENT_CONSUMERS)).toBeVisible();
}

/** The browser reports the tab hidden or shown, as when switching tabs. */
async function setTabHidden(page, hidden) {
  await page.evaluate(state => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => state === 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden ? 'hidden' : 'visible');
}

test.describe('timing', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the clock pauses while the tab is hidden', async ({ page }) => {
    test.setTimeout(180_000);
    await page.clock.install();
    await openEventConsumers(page);
    const challengeSpec = EVENT_CONSUMERS.diagram_challenge;

    await page.clock.fastForward('01:00');
    await setTabHidden(page, true);
    await page.clock.fastForward('30:00');
    await setTabHidden(page, false);
    await page.clock.fastForward('01:00');
    await writeAttempt(page, EVENT_CONSUMERS);
    await answerFromCode(page, EVENT_CONSUMERS);
    await lockIn(page, 'Lock in my answer');
    await answerWithDiagram(page, challengeSpec);
    await answerFollowUpAndEvidence(page, challengeSpec);

    // Two visible minutes count; the hidden half hour does not.
    await expect(stage(page, 'Compare your answers').getByText(/^Your experience, not an experiment: from the code 2 min \d+ s · /))
      .toBeVisible();
  });
});

/** Tab (or Shift+Tab) until `target` has focus; fails if it is unreachable. */
test.describe('code links', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('double-clicking a linked label in the reply diagram opens its code', async ({ page }) => {
    test.setTimeout(180_000);
    await openEventConsumers(page);
    await writeAttempt(page, EVENT_CONSUMERS);
    await answerFromCode(page, EVENT_CONSUMERS);
    await lockIn(page, 'Lock in my answer');
    const [diagram] = EVENT_CONSUMERS.diagram_challenge.reply.diagrams;
    const link = diagram.links.find(item => item.text === 'Notifications');
    const label = diagramRegion(page, diagram.type).locator('svg text').filter({ hasText: /^\s*Notifications\s*$/ });

    await label.dblclick();

    await expect(fileTab(page, link.path)).toHaveAttribute('aria-current', 'true');
    await expect.poll(() => editorLocation(page)).toEqual({ path: link.path, line: link.line });
    await expect(codeEditor(page)).toBeVisible();
    await expect(diagramRegion(page, diagram.type)).toBeVisible();

    // A note's citation of a project file is a link too.
    await diagramRegion(page, diagram.type).locator('svg tspan', { hasText: /^deploy\/broker\.toml:16$/ }).dblclick();
    await expect.poll(() => editorLocation(page)).toEqual({ path: 'deploy/broker.toml', line: 16 });
  });
});

async function tabTo(page, target, { backward = false, max = 200 } = {}) {
  for (let presses = 0; presses < max; presses++) {
    if (await target.evaluate(element => element === document.activeElement)) return;
    await page.keyboard.press(backward ? 'Shift+Tab' : 'Tab');
  }
  throw new Error(`Keyboard focus never reached ${target}`);
}

/** The focused control shows a focus indicator (outline or ring). */
async function expectVisibleFocus(page) {
  const problem = await page.evaluate(() => {
    const element = document.activeElement;
    if (!element || element === document.body) return 'nothing has focus';
    const style = getComputedStyle(element);
    const outlined = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
    const ringed = style.boxShadow !== 'none';
    if (!element.matches(':focus-visible') || !(outlined || ringed)) {
      return `${element.tagName} "${(element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 40)}" shows no focus`;
    }
    return '';
  });
  expect(problem).toBe('');
}

test.describe('keyboard only', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('tree, file, search, lock-in, evidence line, and back to the form', async ({ page }) => {
    test.setTimeout(180_000);
    await openEventConsumers(page);
    const challengeSpec = EVENT_CONSUMERS.diagram_challenge;
    const fromCode = stage(page, 'Answer from the code');
    const searchRef = parseRef(challengeSpec.reply.evidence.find(item => item.ref.startsWith('deploy/')).ref);

    // The tree is one tab stop; arrows move inside it, Enter opens a file.
    await tabTo(page, fileTree(page).getByRole('treeitem', { name: 'events.py', exact: true }));
    await expectVisibleFocus(page);
    await page.keyboard.press('Home');
    await expect(treeItem(page, 'deploy')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(treeItem(page, 'broker.toml')).toBeFocused();
    await expectVisibleFocus(page);
    await page.keyboard.press('Enter');
    await expect(fileTab(page, 'deploy/broker.toml')).toHaveAttribute('aria-current', 'true');

    // Search, then a result opens the file at its line in the editor.
    await search(page, sharedFileLines(searchRef.path)[searchRef.line - 1].trim());
    await expectVisibleFocus(page);
    await tabTo(page, searchResult(page, searchRef.path, searchRef.line));
    await expectVisibleFocus(page);
    await page.keyboard.press('Enter');
    await expect(codeEditor(page)).toBeFocused();
    await expect.poll(() => editorLocation(page)).toEqual(searchRef);

    // Back to the form: pin the line, write the attempt, and answer.
    await page.keyboard.press('Escape');
    await tabTo(page, fromCode.getByLabel('Your hypothesis, in one sentence'), { backward: true });
    await expectVisibleFocus(page);
    await page.keyboard.type('Every queue bound to the trips exchange receives the event.');
    await tabTo(page, fromCode.getByRole('button', { name: 'Pin this line' }));
    await expectVisibleFocus(page);
    await page.keyboard.press('Enter');
    await expect(fromCode.getByRole('button', { name: `${searchRef.path}:${searchRef.line}`, exact: true })).toBeVisible();
    // Each further line the step asks for: back to the editor, one line down, pin it.
    for (let pinned = 1; pinned < challengeSpec.attempt.evidence_pins; pinned++) {
      await tabTo(page, codeEditor(page));
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Escape');
      await tabTo(page, fromCode.getByRole('button', { name: 'Pin this line' }), { backward: true });
      await page.keyboard.press('Enter');
      await expect(fromCode.getByRole('button', { name: `${searchRef.path}:${searchRef.line + pinned}`, exact: true })).toBeVisible();
    }
    await tabTo(page, fromCode.getByLabel('What would you want a diagram of this code to show?'));
    await page.keyboard.type('Each consumer with its binding key.');
    for (const [index, question] of challengeSpec.questions.entries()) {
      const options = optionsOf(numberedGroup(fromCode, index + 1), question);
      if (question.type === 'multiple') {
        for (const key of keyIndices(question)) {
          await tabTo(page, options.nth(key));
          await expectVisibleFocus(page);
          await page.keyboard.press('Space');
        }
      } else {
        // A radio group is one tab stop; arrows choose within it.
        await tabTo(page, options.first());
        for (let step = 0; step < question.correct_index; step++) await page.keyboard.press('ArrowDown');
        await expect(options.nth(question.correct_index)).toBeChecked();
      }
    }
    await tabTo(page, fromCode.getByLabel('Guessing', { exact: true }));
    await page.keyboard.press('ArrowDown');
    await expect(fromCode.getByLabel('Fairly sure', { exact: true })).toBeChecked();
    await expectVisibleFocus(page);

    // Lock in through the confirmation dialog.
    await tabTo(page, fromCode.getByRole('button', { name: 'Lock in my answer' }));
    await expectVisibleFocus(page);
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Lock in your answer?' });
    await tabTo(page, dialog.getByRole('button', { name: 'Lock in', exact: true }));
    await expectVisibleFocus(page);
    await page.keyboard.press('Enter');
    const reply = stage(page, 'The agent’s reply');
    await expect(reply.getByRole('heading', { name: 'The agent’s reply' })).toBeFocused();
    await expectVisibleFocus(page);

    // An evidence note opens its line; Escape leaves the editor.
    const evidence = parseRef(challengeSpec.reply.evidence[0].ref);
    await tabTo(page, reply.getByRole('button', { name: new RegExp(escapeRegExp(challengeSpec.reply.evidence[0].ref) + '$') }));
    await expectVisibleFocus(page);
    await page.keyboard.press('Enter');
    await expect(codeEditor(page)).toBeFocused();
    await expect.poll(() => editorLocation(page)).toEqual(evidence);
    await page.keyboard.press('Escape');

    // Back to the form with the diagram: check the answers.
    const withDiagram = stage(page, 'Answer with the diagram');
    await tabTo(page, withDiagram.getByRole('button', { name: checkLabel(challengeSpec.questions), exact: true }), { backward: true });
    await expectVisibleFocus(page);
    await page.keyboard.press('Enter');
    await expect(withDiagram.getByRole('heading', { name: /^\d+ of \d+ correct$/ })).toBeFocused();
  });
});

/** No horizontal page scrolling, at any width (WCAG 1.4.10). */
async function expectNoHorizontalScroll(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

for (const { name, viewport, deviceScaleFactor } of [
  { name: '320 px wide', viewport: { width: 320, height: 640 }, deviceScaleFactor: 1 },
  // 1440 × 900 at 200 % zoom lays out as 720 × 450 CSS pixels.
  { name: '200 % zoom', viewport: { width: 720, height: 450 }, deviceScaleFactor: 2 },
]) {
  test.describe(`reflow at ${name}`, () => {
    test.use({ viewport, deviceScaleFactor });

    test('Files is a disclosure above the editor and the diagram follows the form', async ({ page }) => {
      test.setTimeout(180_000);
      await openEventConsumers(page);
      // The disclosure's control is its <summary>, which Playwright gives no role.
      const disclosure = page.locator('summary', { hasText: /^Files$/ });
      await expect(disclosure).toBeVisible();
      await expect(fileTree(page)).toBeHidden();
      const disclosureBox = await disclosure.boundingBox();
      expect(disclosureBox.y + disclosureBox.height)
        .toBeLessThanOrEqual((await page.getByRole('group', { name: /^File tabs/ }).boundingBox()).y);
      await expectNoHorizontalScroll(page);

      const fromCode = stage(page, 'Answer from the code');
      const { searchRef, treeRef } = pinRefs(EVENT_CONSUMERS.diagram_challenge);
      await fromCode.getByLabel('Your hypothesis, in one sentence').fill('Every bound queue receives it.');
      await fromCode.getByLabel('Your hypothesis, in one sentence').focus();
      // Files is a closed disclosure at this width, so both lines come from search.
      await pinThroughSearch(page, fromCode, searchRef);
      await pinThroughSearch(page, fromCode, treeRef);
      await fromCode.getByLabel('What would you want a diagram of this code to show?').fill('Each consumer and its binding.');
      await answerFromCode(page, EVENT_CONSUMERS);
      await lockIn(page, 'Lock in my answer');

      const pane = page.getByRole('region', { name: 'Diagram', exact: true });
      await expect(diagramRegion(page, 'component')).toBeVisible();
      const formBox = await stage(page, 'Answer with the diagram').boundingBox();
      expect((await pane.boundingBox()).y).toBeGreaterThanOrEqual(formBox.y + formBox.height - 1);
      await expectNoHorizontalScroll(page);
      await a11yCheckpoint(page, `uml-design-questions: locked at ${name}`, { feature: 'diagram-challenge' });
    });
  });
}

test.describe('Files sidebar at 1440 px', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Headliner file and folder names fit on one line', async ({ page }) => {
    await page.goto(PAGE + '?autosave=false');
    await waitForBoot(page);
    const lineHeight = (await treeItem(page, 'README.md').boundingBox()).height;

    for (const name of ['support_console', 'shuttle_planner', 'slow_group_checkout.py']) {
      await expect(treeItem(page, name)).toBeVisible();
      expect((await treeItem(page, name).boundingBox()).height, `${name} wraps`).toBeLessThanOrEqual(lineHeight + 1);
    }
    // Every other row in view too; an open folder's box also holds its children.
    for (const item of await fileTree(page).getByRole('treeitem').all()) {
      if (await item.getAttribute('aria-expanded') === 'true') continue;
      const name = await item.getAttribute('aria-label');
      expect((await item.boundingBox()).height, `${name} wraps`).toBeLessThanOrEqual(lineHeight + 1);
    }
  });
});
