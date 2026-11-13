/* Instrumental karaoke. All motion and lyric progress use the shared audio clock. */
(function () {
  'use strict';

  const clamp = value => Math.max(0, Math.min(1, value));

  // Semantic parts keep poses independent of the illustration geometry.
  function makeFace(kit, parent, x, y, spacing, scale = 1) {
    const face = kit.svg('g', { transform: `translate(${x} ${y}) scale(${scale})` }, parent);
    const eyes = kit.svg('g', { class: 'ac-eyes' }, face);
    [-spacing, spacing].forEach(cx => {
      kit.svg('ellipse', { class: 'ac-eye', cx, cy: 0, rx: 10, ry: 13 }, eyes);
      kit.svg('ellipse', { class: 'ac-pupil', cx: cx + 2, cy: 2, rx: 5, ry: 8 }, eyes);
      kit.svg('circle', { class: 'ac-eye', cx: cx - 1, cy: -2, r: 3 }, eyes);
      kit.svg('ellipse', { class: 'ac-blush', cx: cx * 1.5, cy: 21, rx: 10, ry: 4 }, face);
    });
    const lids = kit.svg('path', { class: 'ac-closed-eyes is-hidden', d: `M${-spacing - 8} 1 q8 -6 16 0 M${spacing - 8} 1 q8 -6 16 0` }, face);
    kit.svg('path', { class: 'ac-smile', d: 'M-13 20 Q0 42 13 20 Q0 26 -13 20' }, face);
    return { eyes, lids };
  }

  function makeMascot(kit, parent) {
    const anchor = kit.svg('g', { transform: 'translate(69 103)' }, parent);
    kit.svg('ellipse', { class: 'ac-shadow', cx: 100, cy: 211, rx: 113, ry: 13 }, anchor);
    const feet = [36, 122].map(x => {
      const foot = kit.svg('g', { class: 'ac-motion' }, anchor);
      kit.svg('path', { class: 'ac-limbs', d: `M${x + 15} 168 v26` }, foot);
      kit.svg('path', { class: 'ac-shoe', d: `M${x} 190 h28 q18 2 22 19 h-55 q-4 -12 5 -19Z` }, foot);
      kit.svg('path', { class: 'ac-shoe-detail', d: `M${x - 3} 208 h51 M${x + 18} 195 l8 0 m-6 5 h9` }, foot);
      return foot;
    });
    const body = kit.svg('g', { class: 'ac-motion' }, anchor);
    const arms = [-1, 1].map(side => {
      const arm = kit.svg('g', { class: 'ac-motion' }, body);
      const x = side < 0 ? 2 : 198;
      kit.svg('path', { class: 'ac-limbs', d: `M${x} 96 Q${x + side * 22} 118 ${x + side * 32} 85` }, arm);
      kit.svg('circle', { class: 'ac-glove', cx: x + side * 32, cy: 81, r: 11 }, arm);
      const palm = x + side * 32;
      kit.svg('path', { class: 'ac-finger', d: `M${palm - 7} 75 l-3 -9 M${palm} 73 v-12 M${palm + 7} 75 l3 -9` }, arm);
      return arm;
    });
    kit.svg('rect', { class: 'ac-chassis-depth', x: 7, y: 19, width: 196, height: 153, rx: 24 }, body);
    kit.svg('rect', { class: 'ac-body', width: 196, height: 158, rx: 24 }, body);
    kit.svg('path', { class: 'ac-rim', d: 'M16 33 V25 Q16 14 30 14 H161' }, body);
    kit.svg('rect', { class: 'ac-screen', x: 15, y: 35, width: 166, height: 104, rx: 13 }, body);
    [27, 42, 57].forEach(cx => kit.svg('circle', { class: 'ac-window-dot', cx, cy: 21, r: 4 }, body));
    kit.svg('path', { class: 'ac-screen-shine', d: 'M24 44 H88 L24 105Z' }, body);
    const face = makeFace(kit, body, 98, 70, 29);
    kit.svg('path', { class: 'ac-prompt', d: 'M78 113 l10 8 -10 8 M101 129 h18' }, body);
    kit.svg('path', { class: 'ac-headband', d: 'M-3 67 V31 C-3 -28 199 -28 199 31 V67' }, body);
    [-12, 185].forEach(x => {
      kit.svg('rect', { class: 'ac-headphone', x, y: 49, width: 24, height: 49, rx: 10 }, body);
      kit.svg('path', { class: 'ac-rim', d: `M${x + 7} 59 v24` }, body);
    });
    return { body, arms, feet, face };
  }

  function makeCurtain(kit, parent) {
    const curtain = kit.svg('g', { class: 'ac-curtain' }, parent);
    kit.svg('path', { class: 'ac-curtain-cloth', d: 'M0 0 H164 V137 Q144 151 124 137 Q103 151 82 137 Q61 151 41 137 Q20 151 0 137Z' }, curtain);
    kit.svg('path', { class: 'ac-curtain-fold', d: 'M20 5 v123 M60 5 v123 M103 5 v123 M144 5 v123' }, curtain);
    kit.svg('rect', { class: 'ac-curtain-sign', x: 21, y: 53, width: 122, height: 43, rx: 12 }, curtain);
    const label = kit.svg('text', { x: 82, y: 82 }, curtain);
    label.textContent = 'private';
    return curtain;
  }

  function poseFace(face, time) {
    const blink = time % 5.3 > 5.12;
    face.eyes.classList.toggle('is-hidden', blink);
    face.lids.classList.toggle('is-hidden', !blink);
  }

  function makeLyrics(kit, parent, lines) {
    return lines.map(line => {
      const panel = kit.el('div', 'ac-lyric', parent);
      const words = line.text.split(' ').map(word => kit.el('span', 'ac-word', panel, word));
      return { line, panel, words };
    });
  }

  function updateLyrics(views, active, time) {
    views.forEach((view, index) => {
      view.panel.hidden = index !== active;
      if (index !== active) return;
      // Proportional word sweep is a singing guide; the source contains no vocals.
      const progress = clamp((time - view.line.start) / (view.line.end - view.line.start));
      view.words.forEach((word, wordIndex) => {
        const wordProgress = clamp(progress * view.words.length - wordIndex);
        word.style.setProperty('--ac-fill', `${wordProgress * 100}%`);
        word.classList.toggle('ac-current-word', wordProgress > 0 && wordProgress < 1);
      });
    });
  }

  window.SongChoreographies = window.SongChoreographies || {};
  window.SongChoreographies.always_code = function ({ song, kit, layers }) {
    const lines = song.storyboard.sections.flatMap(section => section.lines);
    const room = kit.el('div', 'ac-song', layers.content);
    const art = kit.svg('svg', { class: 'ac-art', viewBox: '0 0 960 330', focusable: 'false', 'aria-hidden': 'true' }, room);
    kit.svg('path', { class: 'ac-floor', d: 'M36 325 H924' }, art);
    [[310, 112], [917, 123], [302, 281]].forEach(([x, y]) => {
      kit.svg('path', { class: 'ac-spark', d: `M${x} ${y - 9} q0 9 9 9 q-9 0 -9 9 q0 -9 -9 -9 q9 0 9 -9Z` }, art);
    });
    kit.el('div', 'ac-label', room, 'ALWAYS CODE');
    const section = kit.el('div', 'ac-section', room, 'KARAOKE');
    const title = kit.el('div', 'ac-heading', room);
    const mascot = makeMascot(kit, art);
    const scenes = window.AlwaysCodeScenes(kit, art, { makeFace, makeCurtain });
    const lyricsArea = kit.el('div', 'ac-lyrics-area', room);
    const intro = kit.el('div', 'ac-intro', lyricsArea);
    kit.el('strong', null, intro, 'Always Code');
    const count = kit.el('span', null, intro, 'Clean design. Good habits. Your vocals.');
    const lyricViews = makeLyrics(kit, lyricsArea, lines);
    const next = kit.el('div', 'ac-next', lyricsArea);
    const progress = kit.el('div', 'ac-progress', room);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let previous = -2;

    window.Timeline.onFrame(time => {
      const active = lines.findIndex((line, i) => time >= line.start
        && (i === lines.length - 1 || time < lines[i + 1].start));
      const index = Math.max(0, active);
      const elapsed = Math.max(0, time - lines[index].start);
      const beat = (time - song.storyboard.beats.first) * song.storyboard.beats.bpm / 60 * Math.PI;
      intro.hidden = active >= 0;
      count.textContent = time < lines[0].start - 4 ? 'Clean design. Good habits. Your vocals.' : `Ready in ${Math.max(1, Math.ceil(lines[0].start - time))}`;
      if (active !== previous) {
        room.classList.toggle('is-intro', active < 0);
        title.textContent = scenes[index].title;
        // Hard cut: only this line's illustration is visible. No crossfade or carry-over.
        scenes.forEach((scene, i) => scene.node.classList.toggle('is-hidden', active < 0 || i !== index));
        section.textContent = active < 0 ? 'INSTRUMENTAL INTRO' : `${index < 6 ? 'VERSE' : 'CHORUS'} · ${String(index + 1).padStart(2, '0')} / 12`;
        next.textContent = index + 1 < lines.length ? `Next: ${lines[active < 0 ? 0 : index + 1].text}` : 'Keep the behavior. Improve the code.';
        previous = active;
      }
      const poseBeat = reducedMotion.matches ? 0 : beat;
      const poseElapsed = reducedMotion.matches ? 10 : elapsed;
      scenes[index].pose(poseElapsed);
      mascot.body.setAttribute('transform', `translate(0 ${-3 * (1 + Math.sin(poseBeat))}) rotate(${2 * Math.sin(poseBeat / 2)} 98 158)`);
      mascot.arms.forEach((arm, i) => arm.setAttribute('transform', `rotate(${10 * Math.sin(poseBeat + i * Math.PI)} ${i ? 198 : 2} 96)`));
      mascot.feet.forEach((foot, i) => foot.setAttribute('transform', `translate(0 ${-4 * Math.max(0, Math.sin(poseBeat + i * Math.PI))})`));
      poseFace(mascot.face, reducedMotion.matches ? 0 : time);

      updateLyrics(lyricViews, active, time);
      progress.style.transform = `scaleX(${clamp(time / song.duration)})`;
    });
  };
})();
