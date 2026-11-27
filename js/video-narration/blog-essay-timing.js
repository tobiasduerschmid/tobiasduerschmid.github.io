/* Keep each article illustration readable at the fastest playback speed.
   All results are positions on the recorded audio clock, including after a seek. */
(function (root) {
  'use strict';

  const MAX_SPEED = 2;
  const SETTLE = 0.75; // Longest entrance or movement, in media seconds.
  const WORDS_PER_SECOND = 3;
  const words = text => (text || '').trim().split(/\s+/u).filter(Boolean).length;

  function readingTime(wordCount) {
    return SETTLE + MAX_SPEED * Math.max(3, 1 + wordCount / WORDS_PER_SECOND);
  }

  // A disappearing state must finish its reading interval before the anchor
  // that removes it. Persistent additions can remain together on the screen.
  function schedule(beat, line, figureText = [], replacements = []) {
    const start = line(beat.from).start;
    const end = line(beat.to).end;
    const events = new Map();

    function add(anchor, count, index, after = start) {
      const cue = line(anchor.cue || beat.from);
      const spoken = cue.marks[anchor.word] ?? cue.start + index * 0.42;
      const event = { count, at: Math.max(after, spoken - 0.35), first: start, exits: [], dwell: readingTime(count) };
      events.set(anchor, event);
      return event;
    }
    let previous = start;
    beat.items.forEach((item, index) => {
      const labelWords = words(item.label) + (item.detail_at ? 0 : words(item.detail));
      const event = add(item, Math.max(labelWords, words(figureText[index])), index, previous);
      previous = event.at;
      if (item.detail_at) add(item.detail_at, words(item.detail), 0, event.at);
    });
    if (beat.signal) add(beat.signal, words(beat.signal.text), 0);
    for (const { from, to, text, wholeItem } of replacements) {
      const prior = events.get(beat.items[from]);
      const next = events.get(beat.items[to]);
      if (prior && next && from < to) prior.exits.push({ next, dwell: wholeItem ? prior.dwell : readingTime(words(text)) });
    }

    const ordered = [...events.values()].sort((a, b) => a.at - b.at);
    let earliest = start;
    for (const event of ordered) {
      event.first = Math.max(earliest, event.first);
      earliest = event.first;
      for (const { next, dwell } of event.exits) next.first = Math.max(next.first, event.first + dwell);
    }

    // Work back from the cut. Several labels may appear together, but their
    // combined reading time still has to fit before the picture disappears.
    let readingDeadline = end - SETTLE - MAX_SPEED;
    let nextReveal = end;
    for (const event of ordered.reverse()) {
      readingDeadline -= MAX_SPEED * Math.max(1, event.count) / WORDS_PER_SECOND;
      const latest = Math.min(end - event.dwell, ...event.exits.map(({ next, dwell }) => next.time - dwell));
      event.time = Math.max(event.first, Math.min(event.at, readingDeadline, latest, nextReveal));
      nextReveal = event.time;
    }
    return anchor => events.get(anchor).time;
  }

  const api = { schedule };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BlogEssayTiming = api;
})(typeof window === 'undefined' ? globalThis : window);
