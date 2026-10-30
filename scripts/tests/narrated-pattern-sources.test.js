const { loadStory, loadRegistry } = require('../narration/source');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const lessons = loadRegistry('pattern');

// Authors and book titles that narrations draw on, including the UML lessons'
// specification and reference books. Titles are matched with their capitals
// so that "design patterns" and UML's own terms (such as "execution
// specification") stay allowed as concepts.
const NAMED_SOURCE = /Gang of Four|\bGoF\b|Gamma|Buschmann|Pattern-Oriented Software Architecture|\bPOSA\b|Head First|Freeman|Kerievsky|Refactoring to Patterns|Reenskaug|Krasner|Burbeck|Fowler|Nystrom|Rumbaugh|Booch|Jacobson|Reference Manual|Clements|Views and Beyond|Documenting Software Architectures|\bOMG\b|Object Management Group|UML [Ss]pecification|\bUML 2\.\d|Ambler|Elements of UML|\b[Tt]extbook\b|\bSE ?Book\b|\bthe book\b/;

for (const topic of Object.keys(lessons)) {
  test(`${topic}: sources are shown on screen, never spoken`, () => {
    const story = loadStory(topic);
    for (const scene of story.scenes) {
      scene.cues.forEach((cue, index) => {
        assert.doesNotMatch(cue.text, NAMED_SOURCE, `${scene.id}#${index}: move the source to cue.source`);
        if ('source' in cue) assert.ok(typeof cue.source === 'string' && cue.source.trim(), `${scene.id}#${index}: empty source`);
      });
    }
  });
}
