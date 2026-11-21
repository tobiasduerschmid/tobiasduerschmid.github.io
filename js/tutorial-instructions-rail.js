/**
 * Instructions rail for tutorial pages (TutorialCode and UMLTutorialEditor).
 *
 * The instructions panel collapses to a narrow rail in two situations, and
 * both share one layout:
 *   hidden    the learner chose "Hide instructions"; the rail holds a
 *             "Show instructions" button. The choice is kept in this browser
 *             (localStorage `tutorial-instructions-hidden`) for every tutorial.
 *   detached  the instructions are open in a popout window; the rail holds a
 *             button that brings them back. The host reports this state.
 *
 *   TutorialInstructionsRail.attach(panel, {
 *     variant: (state) => 'horizontal' | 'vertical' | 'debugger',
 *     onReattach: () => {},        close the popout (detached rail button)
 *     onChange: (state) => {},     after each layout change; state is
 *                                  'hidden', 'detached', or null
 *   }) → { setDetached(boolean) }
 *
 * Variants (css/tutorial.css, js/debugger/debugger.css):
 *   horizontal  the whole panel shrinks to a rail beside the workspace (a bar
 *               above it where the panels stack);
 *   vertical    a UML view stacked under the instructions keeps the column,
 *               and the instructions shrink to a bar above it;
 *   debugger    the debugger's views keep the column, and a compact bar
 *               replaces the Steps view (TutorialCode uses it only while
 *               the instructions are popped out).
 * Hide moves focus to the rail's button, and Show moves it back to Hide.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'tutorial-instructions-hidden';
  var VARIANTS = ['horizontal', 'vertical', 'debugger'];

  function readHidden() {
    try { return window.localStorage.getItem(STORAGE_KEY) === '1'; } catch (error) { return false; }
  }

  function writeHidden(hidden) {
    try {
      if (hidden) window.localStorage.setItem(STORAGE_KEY, '1');
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) { /* storage unavailable: the choice lasts for this page */ }
  }

  function button(className, icon, label) {
    var node = document.createElement('button');
    node.type = 'button';
    node.className = className;
    var mark = document.createElement('span');
    mark.className = className + '-icon';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = icon;
    var text = document.createElement('span');
    text.className = className + '-label';
    text.textContent = label;
    node.append(mark, text);
    return node;
  }

  function attach(panel, options) {
    options = options || {};
    var variant = typeof options.variant === 'function' ? options.variant : function () { return 'horizontal'; };
    var onChange = typeof options.onChange === 'function' ? options.onChange : function () {};
    var hidden = readHidden();
    var detached = false;

    var hideButton = button('tvm-instructions-hide-btn', '«', 'Hide instructions');
    var navBar = panel.querySelector('.tvm-step-nav-bar');
    if (navBar) navBar.appendChild(hideButton);

    var rail = document.createElement('div');
    rail.className = 'tvm-instructions-rail';
    rail.hidden = true;
    var showButton = button('tvm-instructions-rail-btn', '»', 'Show instructions');
    var reattachButton = button('tvm-instructions-rail-btn', '↩', 'Bring instructions back');
    var detachedMessage = document.createElement('p');
    detachedMessage.className = 'tvm-instructions-rail-msg';
    detachedMessage.textContent = 'Instructions popped out';
    var stepsView = panel.querySelector('.tvm-steps-view');
    panel.insertBefore(rail, stepsView || null);

    function state() {
      if (detached) return 'detached';
      return hidden ? 'hidden' : null;
    }

    function render() {
      var current = state();
      var shape = current ? variant(current) : null;
      panel.classList.toggle('tvm-instructions-railed', !!current);
      VARIANTS.forEach(function (name) {
        panel.classList.toggle('tvm-instructions-rail-' + name, !!current && name === shape);
      });
      rail.hidden = !current;
      if (current === 'detached') rail.replaceChildren(reattachButton, detachedMessage);
      else if (current === 'hidden') rail.replaceChildren(showButton);
      else rail.replaceChildren();
      onChange(current);
    }

    function setHidden(value) {
      hidden = value;
      writeHidden(value);
      render();
    }

    hideButton.addEventListener('click', function () {
      setHidden(true);
      showButton.focus();
    });
    showButton.addEventListener('click', function () {
      setHidden(false);
      hideButton.focus();
    });
    reattachButton.addEventListener('click', function () {
      if (typeof options.onReattach === 'function') options.onReattach();
    });

    render();
    return {
      setDetached: function (value) {
        if (detached === !!value) return;
        detached = !!value;
        render();
      },
    };
  }

  window.TutorialInstructionsRail = { attach: attach, STORAGE_KEY: STORAGE_KEY };
})();
