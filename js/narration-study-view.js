/* Shared presentations for study activities. Frames reuse the authored reader's
   settled diagrams and selected-language code; they never control playback. */
(function () {
  'use strict';
  if (window.NarrationStudyView) return;
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function button(text, action) {
    const node = element('button', text);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  }
  function options(select, items) {
    select.replaceChildren(...items.map(({ value, label }) => {
      const option = element('option', label);
      option.value = value;
      return option;
    }));
  }
  function frame(story, reference) {
    const sceneIndex = story.scenes.findIndex(scene => scene.id === reference.scene);
    const scene = story.scenes[sceneIndex];
    const cueIndex = scene.cues.findIndex(cue => cue.id === reference.cue);
    return { scene, cue: scene.cues[cueIndex], sceneIndex, cueIndex };
  }
  function showFrame(root, target, data, reference, prefix) {
    const { scene, cue, cueIndex } = frame(data.story, reference);
    const language = root.querySelector('[data-setting="language"]')?.value;
    const reading = root.querySelector(`[data-reading-scene="${scene.id}"][data-reading-cue="${cueIndex}"]`);
    target.replaceChildren(element('h4', cue.step || scene.title));
    const artifacts = element('div', '', 'narration-study-artifacts');
    const diagram = data.story.diagrams?.[cue.diagram || scene.diagram];
    const settled = reading?.querySelector('.np-diagram');
    if (diagram && settled?.querySelector('svg')) {
      const picture = element('div', '', 'narration-study-diagram');
      picture.setAttribute('role', 'region');
      picture.setAttribute('aria-label', diagram.label);
      artifacts.append(picture);
      target.append(artifacts);
      window.NarrationDiagram.showReadingStep(picture, settled,
        { type: diagram.type || 'class', focus: cue.diagram_focus, prefix });
    }
    const code = reading?.querySelector(`[data-transcript-language="${language}"] .nja-editor`);
    if (code) {
      const copy = code.cloneNode(true);
      const pre = copy.querySelector('pre');
      pre.tabIndex = 0;
      pre.setAttribute('role', 'region');
      pre.setAttribute('aria-label', `${data.examples[language].label} source code`);
      artifacts.append(copy);
    }
    target.append(artifacts, element('p', cue.note || cue.text));
    if (!diagram && !code) target.append(element('p', cue.visual));
  }
  function renderDiagram(target, type, source, label) {
    const names = { class: 'UMLClassDiagram', sequence: 'UMLSequenceDiagram', state: 'UMLStateDiagram', component: 'UMLComponentDiagram' };
    const renderer = window[names[type]];
    if (!renderer) throw new Error('The diagram renderer is unavailable. Reload this page to try again.');
    if (!source.trim()) throw new Error('Enter diagram source before previewing.');
    window.UMLShared.prepareDiagramContainer(target, type);
    target.dataset.umlType = type;
    target.dataset.umlSpec = source;
    target.dataset.umlRendered = 'true';
    renderer.render(target, source);
    if (!target.querySelector('svg')) throw new Error('No diagram could be drawn. Check the notation against the starter.');
    window.UMLShared.autoFitSVG(target);
    window.UMLShared.applySvgAccessibility(target, type, source, label);
  }
  window.NarrationStudyView = { element, button, options, frame, showFrame, renderDiagram };
})();
