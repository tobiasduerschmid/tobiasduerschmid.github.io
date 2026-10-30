'use strict';
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { compileLesson } = require('./compile');
const ROOT = path.resolve(__dirname, '../..');

function lessonIds(root = ROOT) {
  return readdirSync(path.join(root, '_data/narrations')).filter(name => name.endsWith('.yml')).map(name => name.slice(0, -4)).sort();
}
function loadLesson(topic, root = ROOT) {
  if (!/^[a-z][a-z0-9_-]*$/.test(topic)) throw new Error(`Invalid narration ID: ${topic}`);
  const filename = path.join(root, '_data/narrations', `${topic}.yml`);
  try {
    const source = yaml.load(readFileSync(filename, 'utf8'));
    if (source.id !== topic) throw new Error('id must match the filename');
    const visuals = JSON.parse(readFileSync(path.join(root, '_data/narration_visuals', `${topic}.json`), 'utf8'));
    return compileLesson(source, visuals);
  } catch (error) { throw new Error(`${filename}: ${error.message}`, { cause: error }); }
}
const loadStory = (topic, root = ROOT) => loadLesson(topic, root).story;
function loadRegistry(kind, root = ROOT) {
  return Object.fromEntries(lessonIds(root).map(topic => loadLesson(topic, root)).filter(entry => entry.kind === kind).map(entry => [entry.id, entry.lesson]));
}
module.exports = { ROOT, lessonIds, loadLesson, loadStory, loadRegistry };
