/* The music library of the Composite lesson, built with the pattern it teaches.
   Song, Episode, and Playlist answer the same two requests, duration and play;
   the first design keeps songs, nested playlists, and episodes in separate
   lists and forgets to count episodes. Each narration cue moves the library to
   that cue's state; between cues, students press Play on any row and watch the
   request travel down the tree. */
(function () {
  'use strict';
  const SVG = 'http://www.w3.org/2000/svg';
  const STEP_MS = 320; // how long Play stays on each row it reaches
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let libraries = 0;

  function el(tag, attributes = {}, ...children) {
    const element = tag.startsWith('svg:')
      ? document.createElementNS(SVG, tag.slice(4)) : document.createElement(tag);
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
    element.append(...children);
    return element;
  }

  const wait = ms => new Promise(resolve => { setTimeout(resolve, reducedMotion.matches ? 0 : ms); });
  const clock = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const titleOf = row => (row.kind === 'episode' ? `${row.show}: ${row.name}` : row.name);
  const startsWith = (list, prefix) => prefix.every((value, index) => list[index] === value);
  // A panel's absent fields arrive as JSON null; give every field its empty value.
  const readCue = json => {
    const cue = JSON.parse(json);
    return {
      ...cue,
      episode: cue.episode || '',
      played: cue.played || '',
      queue: cue.queue || [],
      visited: cue.visited || [],
      current: cue.current || '',
      marked: cue.marked || [],
      mark: cue.mark || '',
      flags: cue.flags || {},
    };
  };

  // Leaves answer every request from their own data.
  class Song {
    constructor(row) { this.row = row; }
    duration() { return this.row.seconds; }
    play(queue, visit) {
      visit(this.row);
      queue.push(titleOf(this.row));
    }
  }

  class Episode extends Song {}

  // The composite forwards each request to its items, in order.
  class Playlist {
    constructor(row) {
      this.row = row;
      this.items = [];
    }
    add(item) { this.items.push(item); }
    duration() { return this.items.reduce((total, item) => total + item.duration(), 0); }
    play(queue, visit) {
      visit(this.row);
      this.items.forEach(item => item.play(queue, visit));
    }
  }

  // The first design: one list per kind, and no duration loop for episodes.
  class FirstPlaylist {
    constructor(row) {
      this.row = row;
      this.songs = [];
      this.playlists = [];
      this.episodes = [];
    }
    add(item) {
      if (item instanceof FirstPlaylist) this.playlists.push(item);
      else if (item instanceof Episode) this.episodes.push(item);
      else this.songs.push(item);
    }
    duration() {
      let total = 0;
      this.songs.forEach(song => { total += song.duration(); });
      this.playlists.forEach(playlist => { total += playlist.duration(); });
      return total;
    }
    play(queue, visit) {
      visit(this.row);
      this.songs.forEach(song => song.play(queue, visit));
      this.playlists.forEach(playlist => playlist.play(queue, visit));
      this.episodes.forEach(episode => episode.play(queue, visit));
    }
  }

  // Rows list the library in tree order; each belongs to the closest earlier
  // playlist one level up.
  function build(rows, design) {
    const Group = design === 'first' ? FirstPlaylist : Playlist;
    const items = new Map();
    const open = [];
    rows.forEach(row => {
      let item;
      if (row.kind === 'playlist') item = new Group(row);
      else if (row.kind === 'episode') item = new Episode(row);
      else item = new Song(row);
      items.set(row.id, item);
      open.length = row.depth;
      if (row.depth > 0) open[row.depth - 1].add(item);
      if (row.kind === 'playlist') open[row.depth] = item;
    });
    return items;
  }

  class Library {
    constructor(panel) {
      this.panel = panel;
      this.allRows = JSON.parse(panel.dataset.compositeRows);
      this.id = `composite-library-${++libraries}`;
      this.token = 0;
      this.cue = null;
      this.render();
      this.applyCue(readCue(panel.dataset.compositeCue), false);
    }

    // Replace the static picture with the same library as live controls.
    render() {
      const panel = this.panel;
      panel.removeAttribute('role');
      panel.removeAttribute('aria-label');
      panel.classList.add('is-live');
      panel.setAttribute('role', 'group');
      panel.setAttribute('aria-labelledby', `${this.id}-title`);
      this.title = el('div', { class: 'nja-window-bar', id: `${this.id}-title` });
      this.list = el('ul', { class: 'composite-rows', 'aria-label': 'Library' });
      this.pending = el('p', { class: 'composite-pending', hidden: '' });
      this.queueTitle = el('p', { class: 'composite-queue-title', id: `${this.id}-queue` });
      this.queueList = el('ol', { class: 'composite-queue-list', 'aria-labelledby': `${this.id}-queue` });
      this.queueEmpty = el('p', { class: 'composite-queue-empty' });
      this.note = el('p', { class: 'composite-library-note' });
      this.status = el('p', { class: 'composite-library-status', role: 'status' });
      const reset = el('button', { type: 'button', class: 'composite-reset' }, 'Back to the narration’s picture');
      reset.addEventListener('click', () => {
        this.applyCue(this.cue, false);
        this.status.textContent = 'The library is back to the narration’s picture.';
      });
      panel.replaceChildren(this.title, el('div', { class: 'composite-library-body' },
        this.list, this.pending,
        el('div', { class: 'composite-queue' }, this.queueTitle, this.queueList, this.queueEmpty),
        this.note, el('div', { class: 'composite-library-controls' }, reset), this.status));
    }

    rowsFor(cue) {
      return this.allRows.filter(row => row.kind !== 'episode' || cue.episode === 'added' || cue.episode === 'uncounted');
    }

    // Rebuild the rows and their Play buttons for a design and an episode state.
    // A focused Play button is replaced by the same row's new button.
    drawRows(cue) {
      const designLabel = cue.design === 'first' ? 'first design' : 'composite design';
      this.title.textContent = `Music library · ${designLabel} · try it: press Play on any row`;
      const focused = this.list.contains(document.activeElement)
        ? document.activeElement.closest('[data-row]')?.dataset.row : null;
      this.rows = this.rowsFor(cue);
      this.items = build(this.rows, cue.design);
      this.rowParts = new Map();
      const parents = [];
      this.list.replaceChildren(...this.rows.map(row => {
        parents.length = row.depth;
        const parent = row.depth > 0 ? parents[row.depth - 1] : null;
        if (row.kind === 'playlist') parents[row.depth] = row;
        const button = el('button', { type: 'button', class: 'composite-play', 'aria-label': `Play ${titleOf(row)}` },
          el('svg:svg', { viewBox: '0 0 10 10', 'aria-hidden': 'true', focusable: 'false' }, el('svg:polygon', { points: '3,2 8,5 3,8' })));
        button.addEventListener('click', () => this.press(row.id));
        const tags = el('span', { class: 'composite-tags' });
        const item = el('li', { class: `composite-row composite-row--depth-${row.depth} composite-row--${row.kind}` },
          el('span', { class: 'composite-row-main' }, button, el('span', { class: 'composite-name' }, titleOf(row))), ' ',
          el('span', { class: 'composite-kind' }, row.kind), ' ',
          el('span', { class: 'composite-length' }, clock(this.items.get(row.id).duration())),
          parent ? el('span', { class: 'sr-only' }, `, in ${parent.name}`) : '', tags);
        item.dataset.row = row.id;
        this.rowParts.set(row.id, { item, tags });
        return item;
      }));
      const waiting = cue.episode === 'pending' ? this.allRows.find(row => row.kind === 'episode') : null;
      this.pending.hidden = !waiting;
      if (waiting) {
        this.pending.replaceChildren(el('span', { class: 'composite-tag composite-tag--mark' }, 'new'), ' ',
          `${titleOf(waiting)} `, el('span', { class: 'composite-kind' }, 'episode'), ' ',
          el('span', { class: 'composite-length' }, clock(waiting.seconds)), ` waits to be added to ${this.rows[0].name}`);
      }
      this.structure = `${cue.design}|${cue.episode}`;
      if (focused && this.rowParts.has(focused)) {
        this.rowParts.get(focused).item.querySelector('button').focus({ preventScroll: true });
      }
    }

    // Marks, trace states, and flags, each with a text tag.
    drawMarks({ marked = [], mark = '', flags = {}, visited = [], current = '' }) {
      this.rowParts.forEach(({ item, tags }, id) => {
        const isCurrent = id === current;
        const isVisited = !isCurrent && visited.includes(id);
        item.classList.toggle('is-marked', marked.includes(id));
        item.classList.toggle('is-current', isCurrent);
        item.classList.toggle('is-visited', isVisited);
        item.classList.toggle('is-flagged', Boolean(flags[id]));
        const words = [];
        if (marked.includes(id)) words.push(['mark', mark]);
        if (isCurrent) words.push(['current', 'playing']);
        if (isVisited) words.push(['visited', 'visited']);
        if (flags[id]) words.push(['flag', flags[id]]);
        tags.replaceChildren(...words.flatMap(([kind, text]) => [' ', el('span', { class: `composite-tag composite-tag--${kind}` }, text)]));
      });
    }

    drawQueue(titles, playedId) {
      const played = this.rows.find(row => row.id === playedId);
      this.queueTitle.textContent = played ? `Queue · Play on ${titleOf(played)}` : 'Queue';
      this.queueList.replaceChildren(...titles.map(title => el('li', {}, title)));
      this.queueList.hidden = titles.length === 0;
      this.queueEmpty.hidden = titles.length > 0;
      this.queueEmpty.textContent = played ? 'Empty so far' : 'Nothing played yet';
    }

    addToQueue(title) {
      this.queueList.querySelectorAll('.is-new').forEach(item => item.classList.remove('is-new'));
      this.queueList.append(el('li', { class: 'is-new' }, title));
      this.queueList.hidden = false;
      this.queueEmpty.hidden = true;
    }

    // Move to a cue's state. When the new cue continues the previous trace,
    // play reaches the newly visited rows one at a time.
    async applyCue(cue, animate) {
      const token = ++this.token;
      const previous = this.cue;
      this.cue = cue;
      this.note.hidden = false;
      this.note.textContent = cue.note;
      this.status.textContent = '';
      const { visited } = cue;
      const before = previous ? previous.visited : [];
      const sameRows = `${cue.design}|${cue.episode}` === this.structure;
      if (!sameRows) this.drawRows(cue);
      const continues = animate && sameRows && previous && previous.played === cue.played
        && visited.length > before.length && startsWith(visited, before);
      const steps = continues ? visited.slice(before.length) : [];
      for (const [index, id] of steps.entries()) {
        await wait(STEP_MS);
        if (token !== this.token) return;
        const reached = visited.slice(0, before.length + index + 1);
        this.drawMarks({ ...cue, visited: reached, current: id });
        const row = this.rows.find(candidate => candidate.id === id);
        if (row.kind !== 'playlist') this.addToQueue(titleOf(row));
      }
      if (token !== this.token) return;
      this.drawMarks(cue);
      this.drawQueue(cue.queue, cue.played);
    }

    // A student's press: play visits rows in the design's order and fills the queue.
    async press(id) {
      const token = ++this.token;
      const item = this.items.get(id);
      const row = this.rows.find(candidate => candidate.id === id);
      const queue = [];
      const visits = [];
      item.play(queue, visited => visits.push(visited.id));
      this.note.hidden = true;
      this.status.textContent = '';
      this.drawMarks({});
      this.drawQueue([], id);
      for (const [index, visitId] of visits.entries()) {
        if (index > 0) await wait(STEP_MS);
        if (token !== this.token) return;
        this.drawMarks({ visited: visits.slice(0, index + 1), current: visitId });
        const reached = this.rows.find(candidate => candidate.id === visitId);
        if (reached.kind !== 'playlist') this.addToQueue(titleOf(reached));
      }
      await wait(STEP_MS);
      if (token !== this.token) return;
      this.drawMarks({ visited: visits });
      this.status.textContent = this.describe(row, item, queue, visits);
    }

    describe(row, item, queue, visits) {
      const count = queue.length === 1 ? '1 title' : `${queue.length} titles`;
      let message = `Played ${titleOf(row)}: ${count}, ${clock(item.duration())}.`;
      const listed = this.rows.filter(candidate => candidate.kind !== 'playlist' && visits.includes(candidate.id)).map(titleOf);
      if (listed.some((title, index) => title !== queue[index])) {
        message += ' The first design queues a playlist’s own songs before its nested playlists.';
      }
      if (this.cue.episode === 'uncounted' && visits.some(visited => this.rows.find(candidate => candidate.id === visited).kind === 'episode')) {
        message += ' Its length leaves out the episode, whose loop is missing from duration.';
      }
      return message;
    }
  }

  // Each scene's library stays live; cue changes move it instead of replacing it.
  document.querySelectorAll('.narrated-pattern .nja-stage [data-np-visual] .composite-library').forEach(panel => {
    const library = new Library(panel);
    panel.closest('[data-np-visual]').addEventListener('narrated-pattern:cue', event => {
      const settled = event.detail.settled.querySelector('.composite-library');
      if (!settled) return;
      event.preventDefault();
      library.applyCue(readCue(settled.dataset.compositeCue), true);
    });
  });
})();
