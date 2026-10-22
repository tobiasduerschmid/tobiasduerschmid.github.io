/* Mount the complete hero artwork only in views that can display it. */
(function () {
  'use strict';

  var app = document.getElementById('se-gym-app');
  var avatar = window.HeroAvatar;
  if (!app || !avatar) return;

  var hosts = Array.from(app.querySelectorAll('[data-gym-hero-host]'));
  var states = new WeakMap();
  var refreshQueued = false;

  function hasLayout(host) {
    return host.getClientRects().length > 0 && host.getBoundingClientRect().width > 0;
  }

  function isOnscreen(host) {
    var rect = host.getBoundingClientRect();
    return hasLayout(host) && rect.bottom > 0 && rect.right > 0
      && rect.top < window.innerHeight && rect.left < window.innerWidth;
  }

  function syncMotion(host) {
    var state = states.get(host);
    if (!state || !state.svg) return;
    state.svg._seGymOffscreen = !isOnscreen(host);
    avatar.syncMotion(state.svg);
  }

  function mount(host) {
    if (!host) return Promise.resolve(null);
    var state = states.get(host);
    if (state && state.svg) return Promise.resolve(state.svg);
    if (state && state.pending) return state.pending;
    state = { svg: null, pending: null, failed: false };
    states.set(host, state);
    var variant = host.getAttribute('data-gym-hero-host');
    state.pending = avatar.createSvg(variant).then(function (svg) {
      state.pending = null;
      if (!svg) { state.failed = true; return null; }
      // The user may have switched views while the shared asset was loading.
      if (!hasLayout(host)) return null;
      host.appendChild(svg);
      host.setAttribute('data-hero-loaded', 'true');
      state.svg = svg;
      svg._seGymOffscreen = !isOnscreen(host);
      // The customizer owns its draft; other views use the latest saved avatar.
      if (variant !== 'preview') avatar.applyToSvg(svg, avatar.loadAvatar() || avatar.randomAvatar());
      avatar.syncMotion(svg);
      return svg;
    });
    return state.pending;
  }

  function refresh() {
    refreshQueued = false;
    hosts.forEach(function (host) {
      var state = states.get(host);
      if (hasLayout(host) && (!state || (!state.svg && !state.pending && !state.failed))) mount(host);
      syncMotion(host);
    });
  }

  function scheduleRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(refresh);
  }

  function retryVisibleHosts() {
    hosts.forEach(function (host) {
      var state = states.get(host);
      if (state && state.failed) state.failed = false;
    });
    refresh();
  }

  window.SEGymHeroLoader = { mount: mount };

  // Observe view switches, not the thousands of style changes inside the SVGs.
  var viewObserver = new MutationObserver(retryVisibleHosts);
  ['gym-entrance', 'gym-workout', 'workout-results', 'hero-customizer-modal'].forEach(function (id) {
    var view = document.getElementById(id);
    if (view) viewObserver.observe(view, { attributes: true, attributeFilter: ['class', 'hidden', 'open'] });
  });
  window.addEventListener('resize', scheduleRefresh);
  window.addEventListener('online', retryVisibleHosts);
  // requestAnimationFrame is suspended in background tabs; pause immediately.
  document.addEventListener('visibilitychange', retryVisibleHosts);
  if ('IntersectionObserver' in window) {
    var visibilityObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { syncMotion(entry.target); });
    });
    hosts.forEach(function (host) { visibilityObserver.observe(host); });
  } else {
    window.addEventListener('scroll', scheduleRefresh, { passive: true });
  }
  refresh();
})();
