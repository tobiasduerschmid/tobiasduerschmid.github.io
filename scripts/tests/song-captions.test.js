// Captions for SE Book song videos (scripts/song-video/captions.js): what a
// captions-on viewer reads must follow the storyboard's lyric lines exactly.
const test = require('node:test');
const assert = require('node:assert/strict');
const { songCaptions, lyricCues } = require('../song-video/captions');

const storyboard = {
  duration: 20,
  sections: [
    { id: 'intro', delivery: 'spoken', lines: [{ start: 2, end: 4, text: 'A spoken line.' }] },
    {
      id: 'verse',
      delivery: 'sung',
      lines: [
        { start: 4.2, end: 6, text: 'Sung line one,' },
        { start: 6.1, end: 8, text: 'sung line two.' },
      ],
    },
    { id: 'quiz', delivery: 'call', lines: [{ start: 11, end: 14, text: 'A question?', answer: 'An answer!', answer_at: 12.5 }] },
  ],
};

/** Parses WebVTT text into { start, end, text } with times as strings. */
function parseVtt(vtt) {
  return vtt.trim().split('\n\n')
    .map((block) => block.split('\n'))
    .filter((rows) => rows.length >= 3 && rows[1].includes('-->'))
    .map(([, timing, ...text]) => {
      const [start, end] = timing.split(' --> ');
      return { start, end, text: text.join('\n') };
    });
}

test('sung lines are framed with music notes and spoken lines are not', () => {
  const texts = lyricCues(storyboard).map((cue) => cue.text);

  assert.equal(texts[0], 'A spoken line.');
  assert.equal(texts[1], '♪ Sung line one, ♪');
  assert.equal(texts[2], '♪ sung line two. ♪');
});

test('a call-and-response line becomes the sung question, then the crowd answer from answer_at', () => {
  const cues = lyricCues(storyboard).slice(3);

  assert.deepEqual(cues.map((cue) => cue.text), ['♪ A question? ♪', '♪ (crowd) An answer! ♪']);
  assert.equal(cues[0].start, 11);
  assert.equal(cues[0].end, 12.5);
  assert.equal(cues[1].start, 12.5);
});

test('a cue lingers half a second after its last word, but never into the next line', () => {
  const [spoken, one, two] = lyricCues(storyboard);

  assert.equal(spoken.end, 4.2); // would linger to 4.5, but the next line starts at 4.2
  assert.equal(one.end, 6.1);
  assert.equal(two.end, 8.5); // free to linger: the next line starts at 11
});

test('stretches of 1.5 s or more without words are captioned "[music]", including the edges', () => {
  const cues = parseVtt(songCaptions(storyboard));
  const music = cues.filter((cue) => cue.text === '[music]').map((cue) => [cue.start, cue.end]);

  assert.deepEqual(music, [
    ['00:00:00.000', '00:00:02.000'],
    ['00:00:08.500', '00:00:11.000'],
    ['00:00:14.500', '00:00:20.000'],
  ]);
});

test('the captions file is WebVTT with hh:mm:ss.mmm timestamps', () => {
  const late = { duration: 130, sections: [{ id: 'v', delivery: 'sung', lines: [{ start: 125.25, end: 127, text: 'Late.' }] }] };
  const vtt = songCaptions(late);

  assert.match(vtt, /^WEBVTT\n/);
  assert.ok(parseVtt(vtt).some((cue) => cue.start === '00:02:05.250' && cue.text === '♪ Late. ♪'));
});
