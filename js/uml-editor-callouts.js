/* Visual authoring for ArchUML teaching callouts. The host owns history/rendering. */
(function () {
  'use strict';

  const UML_TYPES = new Set(['class', 'sequence', 'state', 'component', 'deployment', 'usecase', 'activity']);
  const SHAPES = ['rect', 'circle', 'ellipse', 'polygon', 'path', 'line', 'polyline'];
  const modelParts = (svg, selector) => [...svg.querySelectorAll(selector)]
    .filter(element => !element.closest('defs, .uml-callouts, .uml-pg-edit-layer'));
  const visibleText = element => element.textContent.replace(/\s+/g, ' ').trim();

  function targetSource(target) {
    switch (target.kind) {
      case 'text': return 'text ' + JSON.stringify(target.value) + (target.occurrence > 1 ? ' occurrence ' + target.occurrence : '');
      case 'shape': return 'shape ' + target.value + ' occurrence ' + target.occurrence;
      case 'edge': return 'edge ' + target.value + ' ' + target.anchor;
      case 'point': return 'point ' + target.x + ',' + target.y;
      default: return 'element ' + target.value;
    }
  }

  // Capture before the host installs its canvas overlays. Occurrences and route
  // ordering deliberately match UMLCallouts' renderer, not source line order.
  function collectTargets(svg) {
    if (!svg) return [];
    const targets = [];
    const ids = new Set();
    for (const element of modelParts(svg, '[data-layout-id], [data-layout-bounds-id]')) {
      const id = element.getAttribute('data-layout-bounds-id') || element.getAttribute('data-layout-id');
      if (!id || /\s/.test(id) || ids.has(id)) continue;
      ids.add(id);
      targets.push({ value: 'element ' + id, label: 'Element: ' + id, selectionId: id, element });
    }
    const occurrences = new Map();
    for (const element of modelParts(svg, 'text')) {
      const text = visibleText(element);
      if (!text) continue;
      const occurrence = (occurrences.get(text) || 0) + 1;
      occurrences.set(text, occurrence);
      targets.push({ value: targetSource({ kind: 'text', value: text, occurrence }),
        label: 'Text: ' + text + (occurrence > 1 ? ' (' + occurrence + ')' : ''), text, element });
    }
    const allRoutes = window.UMLShared.collectEditableRoutes(svg);
    const routeIds = new Map(allRoutes.map(route => [route.element, route.id]));
    const routes = allRoutes.filter(route =>
      route.element.hasAttribute('data-layout-route-id') && route.element.tagName.toLowerCase() !== 'rect');
    routes.forEach((route, index) => {
      for (const anchor of ['middle', 'start', 'end']) {
        targets.push({ value: 'edge ' + (index + 1) + ' ' + anchor,
          label: 'Relationship ' + (index + 1) + ' — ' + anchor, routeId: route.id,
          element: anchor === 'middle' ? route.element : null, path: true });
      }
    });
    for (const shape of SHAPES) {
      modelParts(svg, shape).forEach((element, index) => {
        const owner = element.closest('[data-layout-fragment-id], [data-layout-activation-id], [data-layout-id]');
        targets.push({ value: 'shape ' + shape + ' occurrence ' + (index + 1), label: 'Shape: ' + shape + ' ' + (index + 1),
          routeId: routeIds.get(element), element, path: ['path', 'line', 'polyline'].includes(shape),
          selectionId: owner && (owner.getAttribute('data-layout-fragment-id') || owner.getAttribute('data-layout-activation-id') || owner.getAttribute('data-layout-id')) });
      });
    }
    return targets;
  }

  function replaceCallout(source, callout, replacement) {
    const lines = source.split('\n');
    if (callout) {
      // Keep line-based model/layout IDs stable when removing an annotation.
      lines[callout.line - 1] = replacement;
    } else {
      const end = lines.findIndex(line => /^\s*@enduml\b/.test(line));
      lines.splice(end < 0 ? lines.length : end, 0, replacement);
    }
    return lines.join('\n');
  }

  /** Create one panel; refresh must run on every host render, before edit overlays. */
  function create({ root, getSource, commitSource, getSelection }) {
    const control = id => root.querySelector('#uml-pg-callout-' + id);
    const toggle = control('toggle');
    const panel = control('panel');
    const saved = control('saved');
    const target = control('target');
    const side = control('side');
    const explanation = control('text');
    const submit = control('submit');
    const remove = control('remove');
    const message = control('status');
    let targets = [];
    let callouts = [];
    let editing = -1;
    let currentType = null;
    let sourceValid = true;
    let sourceRevision = '';
    let loadedForm = '';
    let staleDraft = false;
    let disposeDrag = null;

    function formValue() {
      return JSON.stringify([target.value, side.value, explanation.value]);
    }

    function sourceIsCurrent() {
      return !staleDraft && renderedSourceIsCurrent();
    }

    function renderedSourceIsCurrent() {
      if (getSource() === sourceRevision) return true;
      message.textContent = 'The diagram is updating. Review the preview, then try again.';
      return false;
    }

    function option(value, label) {
      const item = document.createElement('option');
      item.value = value;
      item.textContent = label;
      return item;
    }

    function populateTargets(value) {
      target.replaceChildren(...targets.map(item => option(item.value, item.label)));
      if (value && !targets.some(item => item.value === value)) target.appendChild(option(value, value));
      if (value) target.value = value;
      submit.disabled = staleDraft || !sourceValid || !target.options.length;
      remove.disabled = staleDraft || !sourceValid;
    }

    function loadCallout() {
      staleDraft = false;
      const callout = callouts[editing];
      saved.value = String(editing);
      populateTargets(callout ? targetSource(callout.target) : targets[0]?.value);
      side.value = callout ? callout.side : 'right';
      explanation.value = callout ? callout.text : '';
      explanation.setCustomValidity('');
      submit.textContent = callout ? 'Save callout' : 'Add callout';
      remove.hidden = !callout;
      loadedForm = formValue();
    }

    function useSelection() {
      const selection = getSelection();
      if (!selection?.id) return;
      let match = targets.find(item => (selection.kind === 'route' ? item.routeId : item.selectionId) === selection.id);
      if (!match && selection.kind !== 'route') {
        const labels = targets.filter(item => item.text === selection.label);
        if (labels.length === 1) match = labels[0];
      }
      if (match) target.value = match.value;
      else {
        target.prepend(option('', 'Choose a diagram target'));
        target.value = '';
        message.textContent = 'Choose the diagram part this callout should explain.';
      }
    }

    function open() {
      panel.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      if (editing < 0 && formValue() === loadedForm) {
        useSelection();
        loadedForm = formValue();
      }
      target.focus();
    }

    function openForSelection() {
      editing = -1;
      message.textContent = '';
      loadCallout();
      open();
      if (target.value) explanation.focus();
    }

    function editCallout(index) {
      editing = index;
      loadCallout();
      open();
      explanation.focus();
    }

    function moveCallout(index, nextTarget, nextSide) {
      if (!renderedSourceIsCurrent()) return;
      const callout = callouts[index];
      const line = 'callout ' + nextSide + ' of ' + nextTarget + ' : ' + callout.text;
      const source = replaceCallout(getSource(), callout, line);
      // Keep an unfinished explanation intact when moving its saved callout.
      if (editing === index && !staleDraft) {
        const cleanForm = formValue() === loadedForm;
        target.value = nextTarget;
        side.value = nextSide;
        callouts[index] = window.UMLCallouts.extract(source).callouts[index];
        if (cleanForm) loadedForm = formValue();
      }
      commitSource(source);
      const moved = root.querySelectorAll('.uml-callout')[index];
      if (moved) moved.focus();
      message.textContent = 'Callout attached to ' + nextTarget + '.';
    }

    function close() {
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }

    function refresh(svg, type) {
      if (disposeDrag) disposeDrag();
      disposeDrag = null;
      const supported = UML_TYPES.has(type);
      const preserveDraft = currentType === type && loadedForm && formValue() !== loadedForm;
      const draftTarget = target.value;
      const hadOfferedTarget = targets.some(item => item.value === draftTarget);
      const originalCallout = callouts[editing];
      toggle.hidden = !supported;
      if (currentType !== type) {
        editing = -1;
        panel.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
      }
      currentType = type;
      if (!supported) return;
      targets = collectTargets(svg);
      sourceRevision = getSource();
      try {
        callouts = window.UMLCallouts.extract(sourceRevision).callouts;
        sourceValid = true;
        message.textContent = svg ? '' : 'Add a diagram element first, or remove a callout whose target is missing.';
      } catch (error) {
        callouts = [];
        sourceValid = false;
        message.textContent = error.message;
      }
      if (preserveDraft && originalCallout && !staleDraft) {
        const sameCallout = callout => callout.side === originalCallout.side &&
          targetSource(callout.target) === targetSource(originalCallout.target) && callout.text === originalCallout.text;
        const updatedIndex = callouts.findIndex(sameCallout);
        if (updatedIndex < 0) staleDraft = true;
        else editing = updatedIndex;
      }
      if (preserveDraft && hadOfferedTarget && !targets.some(item => item.value === draftTarget)) staleDraft = true;
      if (!staleDraft && editing >= callouts.length) editing = -1;
      saved.replaceChildren(option('-1', 'New callout'), ...callouts.map((callout, index) =>
        option(String(index), (index + 1) + '. ' + callout.text)));
      if (preserveDraft) {
        populateTargets(draftTarget);
        if (staleDraft) {
          const staleOption = option('stale', 'Changed draft — choose a saved callout or New callout');
          staleOption.disabled = true;
          saved.appendChild(staleOption);
          saved.value = 'stale';
          message.textContent = 'The callout or its target changed in the diagram source. Your draft is kept here; choose a saved callout or New callout before saving.';
        } else saved.value = String(editing);
        submit.textContent = editing >= 0 ? 'Save callout' : 'Add callout';
        remove.hidden = editing < 0;
      } else {
        loadCallout();
      }
      if (svg && sourceValid) disposeDrag = window.UMLCalloutDrag.install({
        svg, targets, callouts, onEdit: editCallout, onMove: moveCallout
      });
    }

    toggle.addEventListener('click', () => panel.hidden ? open() : close());
    control('close').addEventListener('click', close);
    control('new').addEventListener('click', () => {
      editing = -1;
      message.textContent = '';
      loadCallout();
      useSelection();
      loadedForm = formValue();
      target.focus();
    });
    saved.addEventListener('change', () => {
      editing = Number(saved.value);
      message.textContent = '';
      loadCallout();
    });
    explanation.addEventListener('input', () => explanation.setCustomValidity(''));
    control('form').addEventListener('submit', event => {
      event.preventDefault();
      if (!sourceIsCurrent()) return;
      const text = explanation.value.replace(/\s+/g, ' ').trim();
      if (!text) {
        explanation.setCustomValidity('Enter an explanation for this callout.');
        explanation.reportValidity();
        return;
      }
      const line = 'callout ' + side.value + ' of ' + target.value + ' : ' + text;
      const source = replaceCallout(getSource(), callouts[editing], line);
      if (editing < 0) editing = callouts.length;
      loadedForm = formValue();
      commitSource(source);
      message.textContent = 'Callout saved.';
      submit.focus();
    });
    remove.addEventListener('click', () => {
      if (!sourceIsCurrent()) return;
      const source = replaceCallout(getSource(), callouts[editing], '');
      editing = -1;
      loadedForm = formValue();
      commitSource(source);
      message.textContent = 'Callout removed.';
      target.focus();
    });
    return { refresh, openForSelection, isSupported: () => UML_TYPES.has(currentType) };
  }

  window.UMLCalloutEditor = { create };
})();
