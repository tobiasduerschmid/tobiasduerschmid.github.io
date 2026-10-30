#!/usr/bin/env node
'use strict';
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { ROOT, lessonIds, loadLesson } = require('./narration/source');

function main([command = 'check', topic, ...extra]) {
  if (extra.length || !['check', 'compile', 'list'].includes(command)) throw new Error('Usage: node scripts/narration.js [check|compile|list] [topic]');
  const ids = topic ? [topic] : lessonIds();
  if (command === 'list') return console.log(ids.join('\n'));
  const lessons = Object.fromEntries(ids.map(id => [id, loadLesson(id)]));
  if (command === 'compile') return console.log(JSON.stringify(topic ? lessons[topic] : lessons));
  for (const [id, { story }] of Object.entries(lessons)) {
    const timing = JSON.parse(readFileSync(path.join(ROOT, `_data/explainers/${id}_timing.json`), 'utf8'));
    if (timing.speech_sha256 !== story.speech_sha256) throw new Error(`${id}: speech changed; render audio, captions, and timing with scripts/render-explainer-narration.py --topic ${id}`);
    console.log(`${id}: valid script, visual references, and current speech`);
  }
}
try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
