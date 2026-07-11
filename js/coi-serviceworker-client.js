/* global window, navigator */
(function (root) {
  'use strict';

  var ISOLATION_QUERY = 'sebook-coi';

  function updateRegistration(registration) {
    if (!registration) return Promise.resolve();
    return registration.update().catch(function () {
      // A failed background update must not prevent an already-active worker
      // from serving the current release.
    });
  }

  function removeIsolationMarker() {
    var url = new URL(root.location.href);
    if (!url.searchParams.has(ISOLATION_QUERY)) return;
    url.searchParams.delete(ISOLATION_QUERY);
    root.history.replaceState(root.history.state, '', url.href);
  }

  function isolationReloadUrl(requiresIsolation) {
    var url = new URL(root.location.href);
    if (requiresIsolation) url.searchParams.set(ISOLATION_QUERY, '1');
    return url.href;
  }

  function ensure(options) {
    options = options || {};
    var requiresIsolation = !!options.requiresIsolation;
    var needsVmCache = !!options.needsVmCache;
    var workerUrl = options.workerUrl;

    if (!requiresIsolation && !needsVmCache) return Promise.resolve(false);
    if (!workerUrl || !('serviceWorker' in navigator)) {
      if (typeof options.onFailure === 'function') {
        options.onFailure(new Error('Service workers are unavailable in this browser.'));
      }
      return Promise.resolve(false);
    }

    if (requiresIsolation && root.crossOriginIsolated) {
      removeIsolationMarker();
      return navigator.serviceWorker.getRegistration().then(updateRegistration).then(function () {
        return true;
      });
    }

    var currentUrl = new URL(root.location.href);
    var hasIsolationMarker = currentUrl.searchParams.get(ISOLATION_QUERY) === '1';
    var reloading = false;
    function reloadForWorker() {
      if (reloading) return;
      reloading = true;
      root.location.replace(isolationReloadUrl(requiresIsolation));
    }

    if (navigator.serviceWorker.controller) {
      return navigator.serviceWorker.getRegistration().then(function (registration) {
        updateRegistration(registration);
        if (requiresIsolation && !hasIsolationMarker) {
          reloadForWorker();
          return true;
        }
        if (requiresIsolation && hasIsolationMarker && typeof options.onFailure === 'function') {
          options.onFailure(new Error('The tutorial could not enable cross-origin isolation.'));
        }
        return !requiresIsolation;
      });
    }

    navigator.serviceWorker.addEventListener('controllerchange', reloadForWorker, { once: true });
    return navigator.serviceWorker.register(workerUrl).then(function (registration) {
      updateRegistration(registration);
      if (registration.active || registration.waiting) {
        reloadForWorker();
      } else if (registration.installing) {
        registration.installing.addEventListener('statechange', function () {
          if (this.state === 'activated') reloadForWorker();
        });
      }
      return true;
    }).catch(function (error) {
      if (typeof options.onFailure === 'function') options.onFailure(error);
      return false;
    });
  }

  root.SEBookCoiServiceWorker = {
    ensure: ensure,
    isolationQuery: ISOLATION_QUERY
  };
})(window);
