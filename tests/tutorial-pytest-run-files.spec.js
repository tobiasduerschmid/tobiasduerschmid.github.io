// @ts-check
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { test, expect } = require('@playwright/test');

const TUTORIAL_DIR = path.resolve(__dirname, '..', '_data', 'tutorials');

function isPytestFile(filename) {
  const base = path.basename(String(filename || ''));
  return /^test_.+\.py$/i.test(base) || /_test\.py$/i.test(base);
}

function loadTutorials() {
  return fs.readdirSync(TUTORIAL_DIR)
    .filter((file) => file.endsWith('.yml'))
    .sort()
    .map((file) => {
      const fullPath = path.join(TUTORIAL_DIR, file);
      return {
        id: file.replace(/\.yml$/, ''),
        path: fullPath,
        config: yaml.load(fs.readFileSync(fullPath, 'utf8')),
      };
    });
}

test('pytest tutorial steps with multiple pytest files configure toolbar Test to run every file', () => {
  const failures = [];

  for (const tutorial of loadTutorials()) {
    const config = tutorial.config;
    if (!config || !config.pytest || !Array.isArray(config.steps)) continue;

    config.steps.forEach((step, index) => {
      const testFiles = (step.files || [])
        .map((file) => file && file.path)
        .filter(isPytestFile);
      if (testFiles.length <= 1) return;

      const runFiles = Array.isArray(step.run_files) ? step.run_files : [];
      const missing = testFiles.filter((file) => !runFiles.includes(file));
      if (missing.length > 0) {
        failures.push(
          `${tutorial.id} step ${index + 1} (${step.title || 'untitled'}) is missing run_files entries for ${missing.join(', ')}`
        );
      }
    });
  }

  expect(failures).toEqual([]);
});
