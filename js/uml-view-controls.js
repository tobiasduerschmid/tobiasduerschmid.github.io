/** Shared controls for choosing the purpose of an inferred UML diagram. */
(function (global) {
  'use strict';
  const helpByScope = new WeakMap();
  let nextId = 0;
  const explanation = 'Design focus uses UML types and SEBook pseudocode for conditions, loops and assignments. It hides Python name markers, empty no-argument constructors and no-result suffixes. Implementation details keeps source notation. Relations and calls stay the same. Neither view verifies the design.';

  /** Mounts session-only view selection; programmatic setView does not notify. */
  function mount(host, { view = 'design', onChange, helpScope = host, showHelp = true }) {
    const events = new AbortController();
    const group = document.createElement('div');
    group.className = 'uml-view-controls';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'UML view');
    let help = helpByScope.get(helpScope);
    if (showHelp && (!help || !help.isConnected)) {
      help = document.createElement('p');
      help.id = 'uml-view-help-' + (++nextId);
      help.className = 'uml-view-help';
      help.textContent = explanation;
      helpByScope.set(helpScope, help);
      host.append(help);
    }
    const buttons = ['design', 'implementation'].map(value => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = value === 'design' ? 'Design focus' : 'Implementation details';
      if (showHelp) button.title = explanation;
      button.dataset.noTooltip = 'true';
      if (showHelp) button.setAttribute('aria-describedby', help.id);
      button.addEventListener('click', () => {
        if (view === value) return;
        setView(value);
        onChange(value);
      }, { signal: events.signal });
      group.append(button);
      return { button, value };
    });
    host.prepend(group);

    function setView(value) {
      view = value;
      for (const item of buttons) item.button.setAttribute('aria-pressed', String(item.value === view));
    }
    setView(view);
    return { setView, destroy() { events.abort(); group.remove(); } };
  }

  global.UMLViewControls = { mount };
})(window);
