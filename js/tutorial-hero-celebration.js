(function () {
  'use strict';

  var MESSAGE = 'You aced this, keep going!';
  var TEMPLATE_ID = 'quiz-avatar-tpl';
  var REMOVE_AFTER_MS = 4400;
  var removeTimer = null;

  function prefersReducedMotion() {
    if (typeof window.__prefersReducedMotion === 'function') {
      return window.__prefersReducedMotion();
    }
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function removeExisting(root) {
    var scope = root || document;
    var existing = scope.querySelectorAll('.tvm-hero-celebration');
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].parentNode) existing[i].parentNode.removeChild(existing[i]);
    }
  }

  function panelForHost(hostEl) {
    if (!hostEl) return null;
    if (hostEl.classList && hostEl.classList.contains('tvm-test-panel')) return hostEl;
    return hostEl.querySelector && hostEl.querySelector('.tvm-test-panel');
  }

  function savedHeroState() {
    if (!window.HeroAvatar || typeof window.HeroAvatar.loadAvatar !== 'function') return null;
    return window.HeroAvatar.loadAvatar();
  }

  function buildCelebration(state) {
    var template = document.getElementById(TEMPLATE_ID);
    if (!template || !template.content) return null;

    var celebration = document.createElement('div');
    celebration.className = 'tvm-hero-celebration';
    celebration.setAttribute('role', 'status');
    celebration.setAttribute('aria-live', 'polite');
    celebration.setAttribute('aria-atomic', 'true');

    var avatar = document.createElement('div');
    avatar.className = 'tvm-hero-celebration-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.appendChild(template.content.cloneNode(true));

    var bubble = document.createElement('div');
    bubble.className = 'tvm-hero-celebration-bubble';
    bubble.textContent = MESSAGE;

    celebration.appendChild(avatar);
    celebration.appendChild(bubble);

    var svg = avatar.querySelector('[data-gym-hero-svg]');
    if (svg && window.HeroAvatar && typeof window.HeroAvatar.applyToSvg === 'function') {
      window.HeroAvatar.applyToSvg(svg, state);
    }

    return celebration;
  }

  function show(opts) {
    opts = opts || {};
    if (prefersReducedMotion()) return false;

    var state = savedHeroState();
    if (!state) return false;

    var panel = panelForHost(opts.hostEl || document);
    if (!panel) return false;

    if (removeTimer) {
      window.clearTimeout(removeTimer);
      removeTimer = null;
    }
    removeExisting(panel);

    var celebration = buildCelebration(state);
    if (!celebration) return false;

    panel.appendChild(celebration);

    window.requestAnimationFrame(function () {
      if (typeof window.spawnConfetti === 'function') {
        window.spawnConfetti(celebration);
      }
    });

    removeTimer = window.setTimeout(function () {
      removeTimer = null;
      removeExisting(panel);
    }, REMOVE_AFTER_MS);

    return true;
  }

  window.SEGymHeroCelebration = {
    show: show,
    prefersReducedMotion: prefersReducedMotion
  };
}());
