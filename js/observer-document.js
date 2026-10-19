/* Reading views share the SEBook language preference; URLs can select a view. */
(function () {
  'use strict';
  const params = new URLSearchParams(window.location.search);
  const page = document.documentElement;
  const isPrintView = page.classList.contains('print-light-mode');
  const requestedTheme = params.get('theme');
  function applyRequestedTheme() {
    if (!isPrintView && ['light', 'dark'].includes(requestedTheme)) {
      page.classList.toggle('dark-mode', requestedTheme === 'dark');
    }
  }
  applyRequestedTheme();

  function selectedTheme() {
    // Print policy must not replace the theme preference when leaving this view.
    if (isPrintView) return requestedTheme === 'dark' ? 'dark' : 'light';
    return page.classList.contains('dark-mode') ? 'dark' : 'light';
  }

  function selectCodeLanguage(lesson, language) {
    lesson.querySelectorAll('[data-code-language], [data-transcript-language]').forEach(panel => {
      panel.hidden = (panel.dataset.codeLanguage || panel.dataset.transcriptLanguage) !== language;
    });
  }

  function updateViewLinks(lesson, language) {
    lesson.querySelectorAll('[data-observer-document-link]').forEach(link => {
      const target = new URL(link.href);
      target.searchParams.set('language', language);
      target.searchParams.set('theme', selectedTheme());
      link.href = target.href;
    });
  }

  function updateLanguageInURL(language) {
    const current = new URL(window.location.href);
    if (!current.searchParams.has('language')) return;
    current.searchParams.set('language', language);
    window.history.replaceState(window.history.state, '', current.href);
  }

  function enhancePreferences(lesson) {
    const preferences = window.SEBookCodePreferences;
    const language = lesson.querySelector('[data-setting="language"], [data-document-language]');
    const available = Array.from(language.options, option => option.value);
    const requestedLanguage = params.get('language');
    if (available.includes(requestedLanguage)) {
      preferences.set(requestedLanguage);
    }
    preferences.subscribe(() => {
      language.value = preferences.choose(available);
      selectCodeLanguage(lesson, language.value);
      updateViewLinks(lesson, language.value);
      updateLanguageInURL(language.value);
      language.dispatchEvent(new CustomEvent('sebook:languagechange'));
    });
    language.addEventListener('change', () => preferences.set(language.value));

    const themeButton = lesson.querySelector('[data-document-theme]');
    const siteThemeToggle = document.getElementById('darkModeToggle');
    function updateTheme() {
      if (themeButton) themeButton.setAttribute('aria-pressed', String(selectedTheme() === 'dark'));
      if (siteThemeToggle) siteThemeToggle.checked = selectedTheme() === 'dark';
      updateViewLinks(lesson, language.value);
    }
    updateTheme();
    // Real hrefs also preserve preferences when copied or opened in a new tab.
    new MutationObserver(updateTheme).observe(page, { attributes: true, attributeFilter: ['class'] });

    if (lesson.classList.contains('observer-document-page')) {
      lesson.querySelector('.observer-document-controls').hidden = false;
      lesson.querySelector('[data-document-print]').addEventListener('click', () => window.print());
      if (themeButton) themeButton.addEventListener('click', () => page.classList.toggle('dark-mode'));
    }
  }

  function init() {
    applyRequestedTheme();
    document.querySelectorAll('.observer-animation').forEach(enhancePreferences);
  }
  // Deferred scripts run while readyState is interactive, before the site's
  // DOMContentLoaded handlers initialize its theme controls from saved preferences.
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
