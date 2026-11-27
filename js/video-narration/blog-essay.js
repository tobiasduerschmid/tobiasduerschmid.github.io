/* Article artwork follows the read-aloud clock. Each beat describes its
   composition and the cues that bring the objects into view. */
(function () {
  'use strict';

  const { fx, tween, EASE } = window.Timeline;
  const { el, svg } = window.SongKit;
  const story = JSON.parse(document.getElementById('narration-storyboard').textContent);

  function buildBackdrop(stage) {
    const backdrop = svg('svg', { class: 'be-backdrop', viewBox: '0 0 960 540', 'aria-hidden': 'true' }, stage);
    backdrop.innerHTML = `
      <path fill="var(--be-wash-warm)" d="M668 0H960V264C931 229 894 207 854 185C812 162 780 132 758 96C736 59 704 28 668 0Z"/>
      <path fill="var(--be-wash-cool)" d="M0 336C44 369 62 407 118 429C165 448 211 448 251 473C286 495 302 519 328 540H0Z"/>
      <g fill="none" stroke="var(--be-backdrop-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M788 205V100Q788 62 820 41Q852 62 852 100V205
                 M802 205V105Q802 76 820 61Q838 76 838 105V205
                 M852 204V100Q852 62 884 41Q916 62 916 100V205
                 M866 205V105Q866 76 884 61Q902 76 902 105V205
                 M916 204V100Q916 62 948 41Q980 62 980 100V205
                 M930 205V105Q930 76 948 61Q966 76 966 105V205"/>
        <path d="M779 205H960M786 211H960M789 122H852M852 122H916M916 122H960"/>
        <path d="M0 417C43 411 76 419 104 447C134 441 165 444 195 458
                 M0 428C41 420 77 430 104 456C134 450 164 453 187 465
                 M0 440C37 432 76 439 104 465C133 459 159 462 181 473
                 M104 447V465"/>
        <path d="M38 510H141M38 518H106M824 25H923"/>
      </g>`;
  }

  window.SongKit.themes['blog-essay'] = { build: buildBackdrop };

  function enter(node, when, dx = 0, dy = 12) {
    node.classList.add('is-staged');
    fx.slideIn(node, when, { dx, dy, duration: 0.46 });
  }

  function label(parent, tag, className, text) {
    if (text) el(tag, className, parent, text);
  }

  function illustrateMotion(art, when) {
    // Trace edits and decisions where they happen on the illustration.
    for (const stroke of art.querySelectorAll('[data-art-part="checks"], [data-art-part="tick"]')) {
      stroke.setAttribute('stroke-dasharray', '1');
      stroke.setAttribute('stroke-dashoffset', '1');
      fx.draw(stroke, when + 0.1, 0.4);
    }
    for (const part of art.querySelectorAll('[data-art-part="rays"], [data-art-part="reply"], [data-art-part="note"]')) {
      enter(part, when + 0.15, 0, 4);
    }
    const highlight = art.querySelector('[data-art-part="highlight"]');
    if (highlight) {
      tween(highlight, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0)' }], when + 0.09, 0.46);
    }
    const marks = art.querySelector('[data-art-part="marks"]');
    if (marks) {
      Array.from(marks.children).forEach((mark, index) => {
        mark.classList.add('is-staged');
        fx.fadeIn(mark, when + index * 0.1, 0.18);
      });
    }
    const card = art.querySelector('[data-art-part="front-card"]');
    if (card) {
      card.style.translate = '0 7px';
      tween(card, { translate: '0 0' }, when + 0.1, 0.29);
    }
  }

  function item(parent, prop, when, direction, mark) {
    const group = el('div', `be-prop be-prop--${prop.tone || 'blue'}`, parent);
    const art = svg('svg', { class: 'be-prop-art', viewBox: '0 0 200 164', 'aria-hidden': 'true' }, group);
    art.innerHTML = window.BlogEssayArt[prop.art];
    illustrateMotion(art, when);
    label(group, 'p', 'be-prop-label', prop.label);
    if (prop.detail) {
      const detail = el('p', 'be-prop-detail', group, prop.detail);
      if (prop.detail_at) enter(detail, mark(prop.detail_at), 0, 5);
    }
    enter(group, when, direction * 21, 13);
    return group;
  }

  function connector(parent, when, reverse) {
    const arrow = svg('svg', { class: 'be-connector', viewBox: '0 0 70 28' }, parent);
    const shaft = svg('line', { x1: 5, x2: 64, y1: 14, y2: 14, class: 'be-connector-shaft' }, arrow);
    const tip = svg('polyline', { points: '55,5 64,14 55,23', class: 'is-staged' }, arrow);
    if (reverse) arrow.classList.add('be-connector--reverse');
    arrow.classList.add('is-staged');
    fx.fadeIn(arrow, when, 0.14);
    fx.draw(shaft, when, 0.36);
    fx.fadeIn(tip, when + 0.27, 0.12);
  }

  function illustrated(parent, beat, times, mark) {
    const body = el('div', `be-body be-body--${beat.layout}`, parent);
    const reverse = beat.layout === 'reverse';
    const ordered = beat.layout === 'sequence' || reverse || beat.layout === 'orbit';
    const props = el('div', 'be-props', body);
    const featured = beat.layout === 'feature' && beat.items.length > 1;
    const supporting = featured ? el('div', 'be-supporting', body) : null;
    beat.items.forEach((prop, index) => {
      const when = times[index];
      if (ordered && index) connector(props, Math.max(times[index - 1], when - 0.36), reverse);
      const group = item(featured && index ? supporting : props, prop, when, ordered ? (reverse ? 1 : -1) : 0, mark);
      if (featured && !index) group.classList.add('be-prop--hero');
      if (ordered) {
        const underline = el('span', 'be-current-step is-staged', group.querySelector('.be-prop-label'));
        tween(underline, [{ opacity: 0, scale: '0.3 1' }, { opacity: 1, scale: '1 1' }], when, 0.34);
        if (index + 1 < times.length) fx.fadeOut(underline, times[index + 1], 0.23);
      }
    });
    if (beat.layout === 'orbit') {
      // A return arrow makes the feedback loop explicit beside the steps.
      const route = svg('svg', { class: 'be-return', viewBox: '0 0 830 68' }, body);
      const line = svg('path', { d: 'M 762 8 Q 762 51 702 51 H 124 Q 68 51 68 8', class: 'be-connector-shaft' }, route);
      const tip = svg('polyline', { points: '58,20 68,8 79,20', class: 'is-staged' }, route);
      route.classList.add('is-staged');
      const when = Math.max(...times) + 0.05;
      fx.fadeIn(route, when, 0.3);
      fx.draw(line, when, 0.5);
      fx.fadeIn(tip, when + 0.45, 0.12);
    }
  }

  function buildFigure(parent, beat) {
    const body = el('div', 'be-figure-body', parent);
    const art = svg('svg', { class: 'be-figure', viewBox: '0 0 880 324' }, body);
    art.innerHTML = window.BlogEssayFigures[beat.figure](beat);
    return art;
  }

  function figureTiming(art, beat) {
    const text = beat.items.map(() => []);
    art.querySelectorAll('text').forEach(node => {
      const group = node.closest('[data-be-item]');
      if (group) text[Number(group.dataset.beItem)].push(node.textContent.trim());
    });
    const replacements = [];
    art.querySelectorAll('[data-be-exit]').forEach(node => {
      const owner = node.closest('[data-be-item]');
      if (!owner) return;
      const from = Number(owner.dataset.beItem);
      const to = Number(node.dataset.beExit);
      // A question mark may disappear while the surrounding question stays.
      const text = node.textContent.trim();
      replacements.push({ from, to, text, wholeItem: node === owner });
    });
    return { text: text.map(parts => parts.join(' ')), replacements };
  }

  function animateFigure(art, beat, times) {
    const parts = [...art.querySelectorAll('[data-be-item]')];
    parts.forEach(node => {
      const when = times[Number(node.dataset.beItem)];
      if (node.dataset.beMove) {
        const [dx, dy] = node.dataset.beMove.split(' ').map(Number);
        node.style.translate = `${dx}px ${dy}px`;
        tween(node, { translate: '0 0' }, when, 0.7, EASE.inOut);
      } else {
        enter(node, when, 0, 8);
      }
    });
    art.querySelectorAll('[data-be-exit]').forEach(node => {
      fx.fadeOut(node, times[Number(node.dataset.beExit)], 0.28);
    });
    const legend = el('ul', 'be-figure-legend', art.parentElement);
    legend.hidden = true;
    beat.items.forEach((item, index) => {
      const label = el('li', 'be-figure-label', legend, item.label);
      enter(label, times[index], 0, 5);
      const exits = parts.filter(part => Number(part.dataset.beItem) === index)
        .map(part => part.closest('[data-be-exit]')?.dataset.beExit);
      if (exits.length && exits.every(exit => exit !== undefined)) {
        fx.fadeOut(label, Math.max(...exits.map(exit => times[Number(exit)])), 0.28);
      }
    });
  }

  function choreograph({ song, layers }) {
    for (const scene of story.scenes) {
      const line = index => song.line(`${scene.id}-${index}`);
      for (const beat of scene.essay_beats) {
        const start = line(beat.from).start;
        const end = line(beat.to).end;
        // Cut between compositions so their text never competes during a seek.
        const picture = el('div', 'scene is-staged be-picture', layers.content);
        tween(picture, [{ opacity: 1 }, { opacity: 1 }], start, 0.001);
        if (end < song.duration) tween(picture, { opacity: 0 }, end - 0.002, 0.001);
        const heading = el('div', 'be-heading', picture);
        label(heading, 'p', 'be-title', beat.title);
        label(heading, 'p', 'be-subtitle', beat.subtitle);
        const art = beat.layout === 'figure' ? buildFigure(picture, beat) : null;
        const details = art ? figureTiming(art, beat) : {};
        const mark = window.BlogEssayTiming.schedule(beat, line, details.text, details.replacements);
        const times = beat.items.map(mark);
        if (art) animateFigure(art, beat, times);
        else illustrated(picture, beat, times, mark);
        if (beat.signal?.text) {
          const signal = el('p', 'be-signal', picture, beat.signal.text);
          if (beat.signal.link) signal.classList.add('be-signal--linked');
          enter(signal, mark(beat.signal), 0, 7);
        }
      }
    }
  }

  window.SongChoreographies ||= {};
  window.SongChoreographies[story.essay_topic] = choreograph;
})();
