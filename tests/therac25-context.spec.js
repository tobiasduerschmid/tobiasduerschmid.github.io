const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const story = yaml.load(readFileSync(path.join(__dirname, '../_data/explainers/therac25.yml'), 'utf8'));
const timing = JSON.parse(readFileSync(path.join(__dirname, '../_data/explainers/therac25_timing.json'), 'utf8'));
const firstDecisionIndex = story.scenes.findIndex(scene => scene.checkpoint);
const orientationScenes = story.scenes.slice(0, firstDecisionIndex);
const firstDecision = story.scenes[firstDecisionIndex];
const url = '/SEBook/development_practices/therac-25.html';
const caseStudy = page => page.getByRole('region', { name: story.title, exact: true });

test('Therac-25 explains the machine and normal setup before asking for a silent decision', async ({ page }) => {
  expect(orientationScenes.length, 'novices need orientation before investigating the first report').toBeGreaterThan(0);
  await page.goto(url);
  const study = caseStudy(page);
  await expect(study.getByRole('button', { name: 'Next step', exact: true })).toBeVisible();

  for (const scene of orientationScenes) {
    const sceneView = study.getByRole('region', { name: scene.title, exact: true });
    await expect(sceneView.getByRole('heading', { name: scene.title, exact: true })).toBeVisible();
    // Provenance remains available without competing with the initial explanation.
    await expect(sceneView.getByText('Evidence and sources', { exact: true })).toBeVisible();
    await expect(sceneView.getByText(scene.evidence, { exact: false })).toBeHidden();
    await expect(sceneView.getByText(`Our task ${scene.purpose}`, { exact: true })).toBeVisible();
    for (const [cueIndex, cue] of scene.cues.entries()) {
      if (cueIndex > 0) await study.getByRole('button', { name: 'Next step', exact: true }).click();
      const diagram = story.diagrams[cue.diagram || scene.diagram];
      await expect(study.getByRole('img', { name: diagram.label, exact: true })).toBeVisible();
      await expect(sceneView.getByText(diagram.caption, { exact: true })).toBeVisible();
      await expect(study.getByRole('region', { name: 'Current narration' })).toHaveText(cue.text);
      await expect(study.getByRole('button', { name: 'Choose next action', exact: true })).toBeHidden();
      await expect(study.getByRole('radio')).toHaveCount(0);
      await expect(study.getByRole('button', { name: 'Play narration', exact: true })).toBeEnabled();
    }
    // Use the labeled reading action, rather than the icon-only review transport.
    await study.getByRole('button', { name: 'Next scene', exact: true }).filter({ hasText: /^Next scene$/ }).click();
  }

  await expect(study.getByRole('heading', { name: firstDecision.title, exact: true })).toBeVisible();
  await expect(study.getByRole('region', { name: 'Current narration' })).toHaveText(firstDecision.cues[0].text);
  for (const cue of firstDecision.cues.slice(1)) {
    await study.getByRole('button', { name: 'Next step', exact: true }).click();
    await expect(study.getByRole('region', { name: 'Current narration' })).toHaveText(cue.text);
  }
  await study.getByRole('button', { name: 'Choose next action', exact: true }).click();
  const question = study.getByRole('region', { name: `${firstDecisionIndex + 1}. ${firstDecision.label} — Choose the next action`, exact: true });
  await expect(question).toBeVisible();
  await expect(study.getByRole('heading', { name: story.scenes[firstDecisionIndex + 1].title, exact: true })).toBeHidden();
});

test('Therac-25 narration continues through orientation and pauses at the first investigation decision', async ({ page }) => {
  expect(orientationScenes.length).toBeGreaterThan(0);
  const lastOrientation = orientationScenes.at(-1);
  const boundary = timing.scenes.find(scene => scene.id === lastOrientation.id).end;
  await page.goto(url);
  const study = caseStudy(page);
  await study.getByRole('slider', { name: 'Narration position' }).fill((boundary - 0.2).toFixed(2));
  await study.getByRole('button', { name: 'Play narration', exact: true }).click();
  await expect(study.getByRole('heading', { name: firstDecision.title, exact: true })).toBeVisible();
  await expect(study.getByRole('button', { name: 'Pause narration', exact: true })).toBeVisible();
  await expect(study.getByRole('radio')).toHaveCount(0);
  await expect(study.getByRole('region', { name: 'Current narration' })).toHaveText(firstDecision.cues[0].text);
  const decisionBoundary = timing.scenes.find(scene => scene.id === firstDecision.id).end;
  await study.getByRole('slider', { name: 'Narration position' }).fill((decisionBoundary - 0.2).toFixed(2));
  const question = study.getByRole('region', { name: `${firstDecisionIndex + 1}. ${firstDecision.label} — Choose the next action`, exact: true });
  await expect(question).toBeVisible();
  await expect(study.getByRole('button', { name: 'Play narration', exact: true })).toBeDisabled();
  await expect(study.getByRole('heading', { name: story.scenes[firstDecisionIndex + 1].title, exact: true })).toBeHidden();
});
