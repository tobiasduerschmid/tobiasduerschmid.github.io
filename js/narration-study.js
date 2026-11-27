/* Session-local study navigation. The transport remains the only owner of
   lesson position; looking up or inspecting a cue always pauses that clock. */
(function () {
  'use strict';
  if (window.NarrationStudy) return;
  const { element, button, options, frame, showFrame } = window.NarrationStudyView;

  function create(root, data, player) {
    const template = root.querySelector('[data-narration-study-template]');
    if (!template) return { update() {}, close() {}, isOpen: () => false };
    const panel = template.content.firstElementChild.cloneNode(true);
    const surface = root.querySelector('.vn-surface');
    surface.insertBefore(panel, surface.querySelector('.vn-frame'));
    const activity = panel.querySelector('[data-study-activity]');
    const search = panel.querySelector('[data-study-search]');
    const markedOnly = panel.querySelector('[data-study-marked]');
    const results = panel.querySelector('[data-study-results]');
    const searchStatus = panel.querySelector('[data-study-search-status]');
    const sceneSelect = panel.querySelector('[data-study-scene]');
    const marked = new Set();
    const viewed = new Set();
    const answers = new Map();
    const entries = data.story.scenes.flatMap((scene, sceneIndex) => scene.cues.map((cue, cueIndex) => ({
      scene: scene.id, cue: cue.id, sceneIndex, cueIndex, key: `${scene.id}/${cue.id}`,
      title: `${scene.label} · ${cue.step || `Step ${cueIndex + 1}`}`,
      words: [scene.title, scene.label, cue.step, cue.text, cue.note, cue.diagram_focus,
        data.story.diagrams?.[cue.diagram || scene.diagram]?.source].filter(Boolean).join(' ').toLocaleLowerCase(),
    })));
    let current = entries[0];
    let inspectionKey = '';
    const canInspect = Boolean(root.querySelector('[data-reading-scene]'));
    if (!canInspect) activity.querySelector('[value="inspect"]').remove();
    if (!data.study) ['practice', 'compare'].forEach(value => activity.querySelector(`[value="${value}"]`).remove());
    options(sceneSelect, data.story.scenes.map(scene => ({ value: scene.id, label: scene.label })));

    function close() {
      panel.open = false;
      surface.classList.remove('is-studying');
    }
    // Full screen shows the lesson and its navigation. Closing the panel also
    // releases its playback gate while retaining search and practice drafts.
    root.addEventListener('narration-fullscreenchange', event => {
      if (event.detail.active) close();
    });
    function jump(reference) {
      const destination = frame(data.story, reference);
      player.showCue(destination.sceneIndex, destination.cueIndex);
      close();
      const heading = root.querySelectorAll('[data-scene]')[destination.sceneIndex]?.querySelector('h3');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
      root.querySelector('.nja-status').textContent = `Reviewing ${destination.cue.step || destination.scene.label}. Narration paused.`;
    }
    function toggleMark(entry) {
      if (marked.has(entry.key)) marked.delete(entry.key);
      else marked.add(entry.key);
      renderResults();
    }
    function renderResults() {
      const terms = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
      const matches = entries.filter(entry => (!markedOnly.checked || marked.has(entry.key)) && terms.every(term => entry.words.includes(term)));
      results.replaceChildren(...matches.map(entry => {
        const row = element('li');
        const go = button(entry.title, () => jump(entry));
        const mark = button(marked.has(entry.key) ? 'Remove review mark' : 'Review later', () => {
          toggleMark(entry);
          // Replacing the results must not strand keyboard focus on the body.
          const replacement = Array.from(results.querySelectorAll('[data-study-mark]')).find(item => item.dataset.studyMark === entry.key);
          (replacement || markedOnly).focus({ preventScroll: true });
        });
        mark.dataset.studyMark = entry.key;
        mark.setAttribute('aria-label', `${marked.has(entry.key) ? 'Remove review mark' : 'Review later'}: ${entry.title}`);
        mark.setAttribute('aria-pressed', String(marked.has(entry.key)));
        const check = data.checks[entry.sceneIndex];
        const count = answers.get(entry.sceneIndex)?.size || 0;
        const progress = `${viewed.has(entry.key) ? 'Viewed' : 'Not viewed'}${check ? ` · ${count}/${check.questions.length} check questions answered` : ''}`;
        row.append(go, element('span', progress, 'narration-study-progress'), mark);
        return row;
      }));
      searchStatus.textContent = matches.length ? `${matches.length} steps found. Viewed steps and answered checks are tracked separately.` : 'No matching steps. Try another term or clear the review filter.';
      const markCurrent = panel.querySelector('[data-study-mark-current]');
      markCurrent.textContent = marked.has(current.key) ? 'Remove current step’s review mark' : 'Mark current step for review';
      markCurrent.setAttribute('aria-pressed', String(marked.has(current.key)));
    }

    function inspect() {
      const selected = frame(data.story, current);
      sceneSelect.value = selected.scene.id;
      const language = root.querySelector('[data-setting="language"]')?.value;
      const block = data.examples[language]?.blocks[selected.scene.code];
      const targets = panel.querySelector('[data-study-targets]');
      const snapshot = panel.querySelector('[data-study-inspection]');
      const select = index => {
        player.showCue(selected.sceneIndex, index);
        targets.querySelectorAll('button')[index].focus({ preventScroll: true });
      };
      targets.replaceChildren(...selected.scene.cues.map((cue, index) => {
        const lines = block?.focus[cue.focus] || [];
        const label = [cue.step || `Step ${index + 1}`, cue.diagram_focus,
          lines.length ? `lines ${lines.join(', ')}` : ''].filter(Boolean).join(' · ');
        const target = button(label, () => select(index));
        target.setAttribute('aria-pressed', String(index === selected.cueIndex));
        return target;
      }));
      showFrame(root, snapshot, data, current, `${root.id}-inspect`);
      snapshot.querySelectorAll('svg text').forEach(label => {
        const text = label.textContent.trim().split(':')[0].trim();
        const index = selected.scene.cues.findIndex(cue => cue.diagram_focus === text);
        if (index < 0) return;
        label.classList.add('narration-inspectable');
        label.addEventListener('click', () => select(index));
      });
      snapshot.querySelectorAll('[data-line]').forEach(line => {
        const number = Number(line.dataset.line);
        const index = selected.scene.cues.findIndex(cue => block?.focus[cue.focus]?.includes(number));
        if (index < 0) return;
        line.classList.add('narration-inspectable');
        line.addEventListener('click', () => {
          const selection = window.getSelection();
          // Dragging to copy source is not a request to change explanations.
          if (selection && !selection.isCollapsed && snapshot.contains(selection.anchorNode)) return;
          select(index);
        });
      });
      inspectionKey = `${current.key}/${language}`;
    }
    const practice = data.study ? window.NarrationPractice.create(root, panel, data, jump) : null;
    function showActivity() {
      panel.querySelectorAll('[data-study-panel]').forEach(section => { section.hidden = section.dataset.studyPanel !== activity.value; });
      if (activity.value === 'review') renderResults();
      else if (activity.value === 'inspect') inspect();
      else if (activity.value === 'practice') practice.practice();
      else practice.compare();
    }
    panel.addEventListener('toggle', () => {
      surface.classList.toggle('is-studying', panel.open);
      if (panel.open) { player.pause(); showActivity(); }
    });
    // Keep native typing, selection, and button/summary Space activation.
    panel.addEventListener('keydown', event => { if (event.key !== 'Escape') event.stopPropagation(); });
    panel.querySelector('[data-study-close]').addEventListener('click', () => {
      close();
      panel.querySelector('summary').focus({ preventScroll: true });
    });
    panel.querySelector('[data-study-mark-current]').addEventListener('click', () => toggleMark(current));
    activity.addEventListener('change', showActivity);
    sceneSelect.addEventListener('change', () => {
      player.showCue(data.story.scenes.findIndex(scene => scene.id === sceneSelect.value), 0);
      inspect();
    });
    search.addEventListener('input', renderResults);
    markedOnly.addEventListener('change', renderResults);
    root.addEventListener('narration:answer', event => {
      const { sceneIndex, questionIndex } = event.detail;
      if (!answers.has(sceneIndex)) answers.set(sceneIndex, new Set());
      answers.get(sceneIndex).add(questionIndex);
    });
    root.querySelector('[data-setting="language"]')?.addEventListener('sebook:languagechange', () => {
      if (panel.open) showActivity();
    });
    new MutationObserver(() => {
      if (panel.open) requestAnimationFrame(showActivity);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return { close, isOpen: () => panel.open, update({ sceneIndex, cueIndex }) {
      current = entries.find(entry => entry.sceneIndex === sceneIndex && entry.cueIndex === cueIndex);
      viewed.add(current.key);
      const language = root.querySelector('[data-setting="language"]')?.value;
      if (panel.open && activity.value === 'inspect' && inspectionKey !== `${current.key}/${language}`) inspect();
    } };
  }
  window.NarrationStudy = { create };
})();
