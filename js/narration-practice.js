/* Editable diagram practice and paired design frames. Exercise drafts are
   detached/reused when switching activities, and are never persisted. */
(function () {
  'use strict';
  if (window.NarrationPractice) return;
  const { element, button, options, showFrame, renderDiagram } = window.NarrationStudyView;

  function exerciseView(root, exercise, jump) {
    const view = element('div', '', 'narration-exercise');
    const sourceLabel = element('label', 'Your diagram source');
    const editor = element('textarea');
    editor.rows = 12;
    editor.spellcheck = false;
    editor.value = exercise.starter;
    sourceLabel.append(editor);
    const status = element('p');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    // The renderer owns its container's display style. Hide an outer region
    // while the draft changes so its previous diagram cannot look current.
    const preview = element('div');
    const previewPicture = element('div', '', 'narration-study-diagram');
    preview.append(previewPicture);
    preview.setAttribute('role', 'region');
    preview.setAttribute('aria-label', 'Your diagram preview');
    function draw(source, target, label) {
      target.replaceChildren();
      try { renderDiagram(target, exercise.type, source, label); return true; }
      catch (error) { status.textContent = error.message; return false; }
    }
    function previewDraft() {
      if (draw(editor.value, previewPicture, 'Your diagram preview')) {
        status.textContent = 'Preview updated. Use the self-check criteria to assess your design.';
      }
    }
    const solution = element('details', '', 'narration-study-solution');
    solution.append(element('summary', 'Show worked solution and self-check'));
    const solutionPicture = element('div', '', 'narration-study-diagram');
    solutionPicture.setAttribute('role', 'region');
    solutionPicture.setAttribute('aria-label', 'Worked solution diagram');
    const solutionSource = element('pre');
    solutionSource.tabIndex = 0;
    solutionSource.setAttribute('role', 'region');
    solutionSource.setAttribute('aria-label', 'Worked solution source');
    solutionSource.append(element('code', exercise.solution));
    const criteria = element('ul');
    exercise.checks.forEach(check => {
      const label = element('label', '', 'narration-study-checkbox');
      const input = element('input');
      input.type = 'checkbox';
      label.append(input, document.createTextNode(check));
      const item = element('li');
      item.append(label);
      criteria.append(item);
    });
    solution.append(element('p', 'Compare the reasoning as well as the picture. Other designs can also satisfy these criteria.'),
      criteria, solutionPicture, solutionSource);
    solution.addEventListener('toggle', () => {
      if (solution.open) draw(exercise.solution, solutionPicture, 'Worked solution diagram');
    });
    editor.addEventListener('input', () => {
      status.textContent = 'Draft changed. Preview again to update the diagram.';
      preview.hidden = true;
    });
    const actions = element('div', '', 'narration-study-toolbar');
    actions.append(button('Preview my diagram', () => { preview.hidden = false; previewDraft(); }),
      button('Reset to starter', () => {
        editor.value = exercise.starter;
        solution.open = false;
        criteria.querySelectorAll('input').forEach(input => { input.checked = false; });
        preview.hidden = false;
        previewDraft();
        editor.focus();
      }), button('Review the example', () => jump(exercise)));
    view.append(element('h4', exercise.title), element('p', exercise.prompt),
      element('p', 'Edit the diagram notation, preview your change, then compare it with the worked solution. This exercise uses self-assessment.'),
      sourceLabel, actions, status, preview, solution);
    return { view, refresh() {
      if (!preview.hidden) previewDraft();
      if (solution.open) draw(exercise.solution, solutionPicture, 'Worked solution diagram');
    } };
  }

  function create(root, panel, data, jump) {
    const exerciseSelect = panel.querySelector('[data-study-exercise]');
    const comparisonSelect = panel.querySelector('[data-study-comparison]');
    const drafts = new Map();
    const reflections = new Map();
    const { exercises, comparisons } = data.study;
    options(exerciseSelect, exercises.map(item => ({ value: item.id, label: item.title })));
    options(comparisonSelect, comparisons.map(item => ({ value: item.id, label: item.title })));
    function practice() {
      const exercise = exercises.find(item => item.id === exerciseSelect.value);
      if (!drafts.has(exercise.id)) drafts.set(exercise.id, exerciseView(root, exercise, jump));
      const draft = drafts.get(exercise.id);
      panel.querySelector('[data-study-workspace]').replaceChildren(draft.view);
      draft.refresh();
    }
    function compare() {
      const comparison = comparisons.find(item => item.id === comparisonSelect.value);
      const target = panel.querySelector('[data-study-comparison-content]');
      const frames = element('div', '', 'narration-comparison');
      for (const side of ['before', 'after']) {
        const reference = comparison[side];
        const section = element('section', '', 'narration-study-frame');
        const snapshot = element('div');
        section.append(element('h4', reference.label), snapshot,
          button(`Review ${reference.label}`, () => jump(reference)));
        frames.append(section);
        showFrame(root, snapshot, data, reference, `${root.id}-compare-${side}`);
      }
      let reflection = reflections.get(comparison.id);
      if (!reflection) {
        reflection = element('div');
        const label = element('label', 'Your design choice and reasons');
        const answer = element('textarea');
        answer.rows = 3;
        label.append(answer);
        const reveal = element('details');
        reveal.append(element('summary', 'Show consequences'));
        const list = element('ul');
        comparison.consequences.forEach(text => list.append(element('li', text)));
        reveal.append(list);
        reflection.append(label, reveal);
        reflections.set(comparison.id, reflection);
      }
      target.replaceChildren(element('h4', comparison.title), element('p', comparison.question), frames, reflection);
    }
    exerciseSelect.addEventListener('change', practice);
    comparisonSelect.addEventListener('change', compare);
    return { practice, compare };
  }
  window.NarrationPractice = { create };
})();
