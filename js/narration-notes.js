/* One editable handout lifecycle for every narration kind. Visual renderers
   supply settled artwork; student text stays separate from authored content. */
(function () {
  'use strict';
  const root = document.querySelector('[data-notes-topic]');
  const status = document.querySelector('[data-notes-status]');
  const saveStatus = document.querySelector('[data-notes-save-status]');
  const printButton = document.querySelector('[data-notes-print]');
  const story = JSON.parse(document.getElementById('narration-notes-data').textContent);
  const fields = [...root.querySelectorAll('[data-notes-entry]')];
  const key = `sebook-narration-notes-${root.dataset.notesTopic}`;
  const unsaved = new Set();
  const saveFailure = 'Notes could not be saved. Keep this page open and export a PDF to keep your text.';

  function readNotes() {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const record = JSON.parse(raw);
    if (record.version !== 1 || !record.entries || typeof record.entries !== 'object' || Array.isArray(record.entries)) {
      throw new Error('Unsupported saved notes');
    }
    return record.entries;
  }
  function showWritten(field) {
    const editor = field.closest('.vn-note-editor');
    editor.querySelector('[data-notes-written] p').textContent = field.value;
    editor.classList.toggle('has-text', Boolean(field.value.trim()));
    field.closest('.vn-note').classList.toggle('has-written-notes', Boolean(field.value.trim()));
  }
  function restore() {
    try {
      const entries = readNotes();
      fields.forEach(field => {
        if (unsaved.has(field.dataset.notesEntry)) return;
        field.value = typeof entries[field.dataset.notesEntry] === 'string' ? entries[field.dataset.notesEntry] : '';
        showWritten(field);
      });
      saveStatus.textContent = unsaved.size ? saveFailure : 'Notes save automatically on this browser.';
    } catch (_) {
      saveStatus.textContent = 'Saved notes could not be read. You can still type and export this page.';
    }
  }
  fields.forEach(field => { field.disabled = false; field.closest('label').hidden = false; });
  restore();
  fields.forEach(field => field.addEventListener('input', () => {
    showWritten(field);
    unsaved.add(field.dataset.notesEntry);
    try {
      const entries = readNotes();
      if (field.value) entries[field.dataset.notesEntry] = field.value;
      else delete entries[field.dataset.notesEntry];
      if (Object.keys(entries).length) localStorage.setItem(key, JSON.stringify({ version: 1, entries }));
      else localStorage.removeItem(key);
      unsaved.delete(field.dataset.notesEntry);
      saveStatus.textContent = unsaved.size ? saveFailure : 'Notes saved on this browser.';
    } catch (_) {
      saveStatus.textContent = saveFailure;
    }
  }));
  window.addEventListener('storage', event => { if (event.key === key || event.key === null) restore(); });

  // Choose a code language for this handout without changing a site preference.
  const language = root.querySelector('[data-notes-code-language]');
  if (language) {
    language.disabled = false;
    const updateLanguage = () => root.querySelectorAll('[data-notes-language]').forEach(panel => {
      panel.hidden = panel.dataset.notesLanguage !== language.value;
    });
    language.addEventListener('change', updateLanguage);
    updateLanguage();
  }

  function drawExplainerPictures() {
    const renderer = window[root.dataset.notesRenderer];
    for (const slot of root.querySelectorAll('[data-vn-scene][data-vn-cue]')) {
      const scene = story.scenes[slot.dataset.vnScene];
      slot.querySelector('.vn-note-art-drawing').hidden = false;
      renderer.render(slot.querySelector('.vn-explainer-pose'), scene.id, scene.cues[slot.dataset.vnCue], 1, false);
      slot.classList.add('has-pose');
    }
  }
  async function drawPictures() {
    if (root.querySelector('.vn-notes-master')) {
      if (!window.VideoNarrationStage) throw new Error('The animation stage did not load');
      const timing = JSON.parse(document.getElementById('narration-timing').textContent);
      await window.VideoNarrationStage.ready;
      const slots = [...root.querySelectorAll('[data-vn-scene][data-vn-cue]')];
      const sizer = 'ResizeObserver' in window ? new ResizeObserver(entries => {
        for (const entry of entries) entry.target.style.setProperty('--vn-still-scale', entry.contentRect.width / 960);
      }) : null;
      for (const slot of slots) {
        const cue = timing.scenes[slot.dataset.vnScene].cues[slot.dataset.vnCue];
        slot.replaceChildren(window.VideoNarrationStage.still(cue.end - 0.3));
        slot.classList.add('has-still');
        if (sizer) sizer.observe(slot);
      }
      root.querySelector('.vn-notes-master').remove();
    } else if (root.dataset.notesRenderer) {
      drawExplainerPictures();
      // Token destinations depend on the available width, including the
      // transition from the screen layout to a printable sheet of paper.
      window.addEventListener('resize', drawExplainerPictures);
      window.addEventListener('beforeprint', drawExplainerPictures);
      window.addEventListener('afterprint', drawExplainerPictures);
    }
  }
  async function prepare() {
    status.textContent = 'Drawing the pictures…';
    try {
      if (document.fonts) await document.fonts.ready;
      await drawPictures();
      status.textContent = 'The pictures are ready.';
    } catch (_) {
      status.textContent = 'Some pictures could not be drawn. Their descriptions and your notes remain available to print.';
    }
    printButton.hidden = false;
    if (location.hash === '#export') {
      history.replaceState(null, '', location.pathname + location.search);
      window.print();
    }
  }
  printButton.addEventListener('click', () => window.print());
  prepare();
})();
