/* Presents one closer look: the selected step, the visible code language, the
   focused anchors, and the relations drawn between them. It reads everything
   from the markup of _includes/narration-closer-look.html, so the player's
   panel, the notes handout, and the reading view share one presentation. It
   knows nothing about playback (js/narration-closer-look.js opens and closes
   the player's panels).

   Extension points:
   - Content: any element with data-closer-look-focus="group.key" is an
     anchor, so a new content kind only needs an include that marks anchors.
   - Relation kinds: RELATION_HEADS below, `.narration-closer-look-relation--<kind>`
     styles, and the kind in scripts/narration/closer-look.js. */
(function () {
  'use strict';

  // The arrowhead at the target end (x, y), pointing into the code.
  const RELATION_HEADS = {
    call: (x, y) => `M${x} ${y} l11 -6.5 v13 z`,
    dependency: (x, y) => `M${x} ${y} l12 -7 v14 z`,
  };
  const LANE_START = 24;
  const LANE_GAP = 28;
  const SVG = 'http://www.w3.org/2000/svg';

  const words = value => (value || '').split(' ').filter(Boolean);

  function create(container) {
    const stepButtons = [...container.querySelectorAll('[data-closer-look-step]')];
    const steps = [...container.querySelectorAll('[data-closer-look-step-text]')].map(element => ({
      element, focus: words(element.dataset.focus), relation: element.dataset.relation || '', remove: element.dataset.remove || '',
    }));
    const relations = [...container.querySelectorAll('[data-closer-look-relation]')].map(element => ({
      element, kind: element.dataset.closerLookRelation, from: element.dataset.from, to: element.dataset.to,
    }));
    let current = null;

    const visibleContent = () => container.querySelector('[data-closer-look-content] [data-code-language]:not([hidden])')
      || container.querySelector('[data-closer-look-content]');
    const anchors = (scope, name) => [...scope.querySelectorAll(`[data-closer-look-focus~="${CSS.escape(name)}"]`)];

    /** The player: one step at a time. */
    function showStep(index) {
      current = steps[index];
      stepButtons.forEach((button, number) => button.setAttribute('aria-pressed', String(number === index)));
      steps.forEach((step, number) => { step.element.hidden = number !== index; });
      render();
    }

    /** Handouts and reading views: every step's text, every relation, nothing dimmed. */
    function showAll() {
      current = null;
      steps.forEach(step => { step.element.hidden = false; });
      render();
    }

    function showLanguage(language) {
      container.querySelectorAll('[data-closer-look-content] [data-code-language]').forEach(content => {
        content.hidden = content.dataset.codeLanguage !== language;
      });
      render();
    }

    function render() {
      const content = visibleContent();
      if (!content) return;
      content.querySelectorAll('.is-highlighted').forEach(element => {
        element.classList.remove('is-highlighted');
        element.removeAttribute('aria-current');
      });
      (current ? current.focus : []).forEach(name => anchors(content, name).forEach(element => {
        element.classList.add('is-highlighted');
        element.setAttribute('aria-current', 'true');
      }));
      content.querySelectorAll('[data-closer-look-group]').forEach(group => {
        const removed = Boolean(current && current.remove === group.dataset.closerLookGroup);
        group.classList.toggle('is-removed', removed);
        const state = group.querySelector('[data-closer-look-state]');
        if (state) state.textContent = current && current.remove ? (removed ? state.dataset.removedLabel : state.dataset.keptLabel) : '';
      });
      const focused = current && current.relation;
      relations.forEach(relation => {
        relation.element.classList.toggle('is-active', Boolean(focused) && focused === relation.kind);
        relation.element.classList.toggle('is-dim', Boolean(focused) && focused !== relation.kind);
      });
      drawRelations(content);
    }

    function drawRelations(content) {
      const svg = content.querySelector('.narration-closer-look-relations');
      if (!svg) return;
      svg.replaceChildren();
      if (current && current.remove) return;
      const box = content.getBoundingClientRect();
      const blocks = [...content.querySelectorAll('pre')];
      if (!box.width || !blocks.length) return;
      const right = Math.max(...blocks.map(block => block.getBoundingClientRect().right)) - box.left;
      const middle = element => {
        const rect = element.getBoundingClientRect();
        return rect.top - box.top + rect.height / 2;
      };
      svg.setAttribute('width', String(box.width));
      svg.setAttribute('height', String(box.height));
      relations.forEach((relation, index) => {
        const from = anchors(content, relation.from)[0];
        const to = anchors(content, relation.to)[0];
        if (!from || !to) return;
        const y1 = middle(from);
        const y2 = middle(to);
        const lane = right + LANE_START + LANE_GAP * index;
        const group = element('g', { class: `narration-closer-look-relation narration-closer-look-relation--${relation.kind}` });
        if (relation.element.classList.contains('is-active')) group.classList.add('is-active');
        if (relation.element.classList.contains('is-dim')) group.classList.add('is-dim');
        group.append(
          element('path', { class: 'narration-closer-look-relation-line', d: `M${right + 2} ${y1} H${lane} V${y2} H${right + 14}` }),
          element('path', { class: 'narration-closer-look-relation-head', d: RELATION_HEADS[relation.kind](right + 4, y2) }),
        );
        svg.append(group);
      });
    }

    function element(name, attributes) {
      const node = document.createElementNS(SVG, name);
      Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
      return node;
    }

    stepButtons.forEach((button, index) => button.addEventListener('click', () => showStep(index)));
    const content = container.querySelector('[data-closer-look-content]');
    if (content) new ResizeObserver(render).observe(content);
    return { showStep, showAll, showLanguage, refresh: render };
  }

  /** Handouts and reading views: show everything; the language select changes
   * this page only and never the site's saved code language. */
  function enhanceStatic(scope = document) {
    scope.querySelectorAll('[data-closer-look-static]').forEach(block => {
      if (block.dataset.closerLookEnhanced) return;
      block.dataset.closerLookEnhanced = 'true';
      const view = create(block);
      const select = block.querySelector('[data-closer-look-language]');
      if (select) {
        const preferences = window.SEBookCodePreferences;
        if (preferences) select.value = preferences.choose([...select.options].map(option => option.value));
        view.showLanguage(select.value);
        select.addEventListener('change', () => view.showLanguage(select.value));
      }
      view.showAll();
    });
  }

  window.NarrationCloserLookView = { create, enhanceStatic };
  // Deferred scripts after this one (the code-language preference) run before DOMContentLoaded.
  if (document.readyState === 'complete') enhanceStatic();
  else document.addEventListener('DOMContentLoaded', () => enhanceStatic(), { once: true });
})();
