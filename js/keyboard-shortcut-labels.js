/** Display the platform's primary modifier in explicitly marked shortcut hints. */
(function () {
  'use strict';

  const platform = navigator.userAgentData && navigator.userAgentData.platform
    ? navigator.userAgentData.platform : navigator.platform || '';
  if (!/Mac|iPhone|iPad|iPod/i.test(platform)) return;

  function labelModifiers(root) {
    if (root.nodeType !== 1) return;
    const modifiers = Array.from(root.querySelectorAll('abbr[data-platform-modifier]'));
    if (root.matches('abbr[data-platform-modifier]')) modifiers.unshift(root);
    modifiers.forEach(function (modifier) {
      if (modifier.textContent !== '⌘') modifier.textContent = '⌘';
      modifier.setAttribute('title', 'Command');
    });
  }

  function start() {
    labelModifiers(document.documentElement);
    // Tutorial instructions are replaced when the learner changes steps.
    new MutationObserver(function (records) {
      records.forEach(function (record) {
        record.addedNodes.forEach(labelModifiers);
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
