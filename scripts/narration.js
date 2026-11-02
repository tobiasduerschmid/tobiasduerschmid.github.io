#!/usr/bin/env node
'use strict';
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { checkSpeech } = require('./narration/compile');
const { ROOT, lessonIds, loadLesson } = require('./narration/source');

function main([command = 'check', topic, ...extra]) {
  if (extra.length || !['check', 'compile', 'list'].includes(command)) throw new Error('Usage: node scripts/narration.js [check|compile|list] [topic]');
  const ids = topic ? [topic] : lessonIds();
  if (command === 'list') return console.log(ids.join('\n'));
  const lessons = Object.fromEntries(ids.map(id => [id, loadLesson(id)]));
  if (command === 'compile') return console.log(JSON.stringify(topic ? lessons[topic] : lessons));
  for (const [id, { story }] of Object.entries(lessons)) {
    const file = path.join(ROOT, `_data/explainers/${id}_timing.json`);
    const timing = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
    console.log(checkSpeech(id, story, timing));
  }
}
try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
