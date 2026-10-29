/* Estimated word times for a narration cue, keyed the way song-video marks
   are: a word lowercase and without punctuation, a repeated word as word2,
   word3, and so on. Speech runs at a nearly even rate, so a word starts in
   proportion to the characters and punctuation pauses spoken before it.
   Used by the animated stage (js/video-narration-stage.js) and its tests. */
(function (root) {
  'use strict';
  // Pauses at punctuation, in characters of speech.
  const PAUSE_WEIGHT = { ',': 4, ';': 6, ':': 6, '.': 9, '?': 9, '!': 9 };

  function wordMarks(text, start, speechEnd) {
    const tokens = Array.from(text.matchAll(/([A-Za-z0-9’']+)([^A-Za-z0-9’']*)/g), ([, word, after]) => ({
      key: word.toLowerCase().replace(/[’']/g, ''),
      weight: word.length + Math.max(1, ...Array.from(after, character => PAUSE_WEIGHT[character] || 1)),
    }));
    const total = tokens.reduce((sum, token) => sum + token.weight, 0);
    const seen = new Map();
    const marks = {};
    let spoken = 0;
    for (const token of tokens) {
      const count = (seen.get(token.key) || 0) + 1;
      seen.set(token.key, count);
      marks[count === 1 ? token.key : `${token.key}${count}`] = start + (speechEnd - start) * spoken / total;
      spoken += token.weight;
    }
    return marks;
  }

  const api = { wordMarks };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VideoNarrationMarks = api;
})(typeof window === 'undefined' ? globalThis : window);
