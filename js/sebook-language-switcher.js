/** Shared language tabs for SEBook examples and live code labs. */
(function (global) {
  'use strict';
  const preferences = global.SEBookCodePreferences;
  const switchers = new WeakMap();
  let nextId = 0;

  function initSwitcher(root) {
    if (switchers.has(root)) return switchers.get(root);
    const buttons = [...root.querySelectorAll('[data-language-option]')];
    const languages = buttons.map(button => button.dataset.languageOption);
    const panels = [...root.querySelectorAll('[data-language-panel]')];
    const events = new AbortController();
    const prefix = 'sebook-language-' + (++nextId);
    let selectedLanguage;

    panels.forEach((panel, index) => {
      if (!panel.id) panel.id = prefix + '-panel-' + index;
    });
    buttons.forEach((button, index) => {
      if (!button.id) button.id = prefix + '-tab-' + index;
      const panel = panels.find(candidate => !candidate.dataset.languagePanel
        || candidate.dataset.languagePanel === button.dataset.languageOption);
      if (panel) button.setAttribute('aria-controls', panel.id);
    });

    function activate(language) {
      if (language === selectedLanguage) return;
      const selected = buttons.find(button => button.dataset.languageOption === language);
      if (!selected) return;
      buttons.forEach(button => {
        const active = button === selected;
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
      });
      panels.forEach(panel => {
        // An empty language value is one shared panel, such as a live editor.
        const active = !panel.dataset.languagePanel || panel.dataset.languagePanel === language;
        panel.classList.toggle('is-active', active);
        panel.setAttribute('aria-hidden', String(!active));
        panel.toggleAttribute('inert', !active);
        const label = buttons.find(button => button.dataset.languageOption === panel.dataset.languagePanel) || selected;
        panel.setAttribute('aria-labelledby', label.id);
      });
      selectedLanguage = language;
      root.dispatchEvent(new CustomEvent('sebook:languagechange', { detail: { language } }));
    }

    buttons.forEach((button, index) => {
      button.addEventListener('click', () => preferences.set(button.dataset.languageOption), { signal: events.signal });
      button.addEventListener('keydown', event => {
        let target;
        if (event.key === 'ArrowRight') target = (index + 1) % buttons.length;
        else if (event.key === 'ArrowLeft') target = (index - 1 + buttons.length) % buttons.length;
        else if (event.key === 'Home') target = 0;
        else if (event.key === 'End') target = buttons.length - 1;
        else return;
        event.preventDefault();
        preferences.set(buttons[target].dataset.languageOption);
        buttons[target].focus();
      }, { signal: events.signal });
    });

    const unsubscribe = preferences.subscribe(() => activate(preferences.choose(languages, root.dataset.defaultLanguage)));
    const controller = {
      get language() { return selectedLanguage; },
      destroy() {
        events.abort();
        unsubscribe();
        switchers.delete(root);
        delete root.dataset.languageSwitcherReady;
      }
    };
    switchers.set(root, controller);
    root.dataset.languageSwitcherReady = 'true';
    return controller;
  }

  function initAll(scope = document) {
    scope.querySelectorAll('[data-language-switcher]').forEach(initSwitcher);
  }

  global.SEBookLanguageSwitcher = { initAll, initSwitcher };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initAll());
  else initAll();
})(window);
