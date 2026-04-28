/**
 * Cross-Origin Isolation Service Worker + VM Asset Cache
 *
 * Two responsibilities:
 *  1. Inject COOP/COEP headers on same-origin responses so SharedArrayBuffer
 *     is available on GitHub Pages (which doesn't let us set custom headers).
 *  2. Cache the v86 VM assets (snapshot, kernel, BIOS, wasm) so repeat visits
 *     skip the multi-MB downloads. GitHub Pages defaults to 10-min HTTP cache;
 *     this cache survives much longer and is more eviction-resistant on mobile.
 *
 * Usage: register from the tutorial layout when backend is webcontainer / v86,
 * or when the time-travel debugger is enabled. On first registration the page
 * reloads once so the SW becomes the controller.
 *
 * Bump VM_CACHE when shipping a new state.bin.gz / rootfs / kernel — the
 * activate handler deletes any cache entry under a different key, so users on
 * the previous version get fresh bytes on next visit.
 */
'use strict';

var VM_CACHE = 'vm-assets-v1';

// Match same-origin VM asset paths exactly so unrelated requests (HTML, CSS,
// page-specific JSON) keep going through the COI rewrite path below.
var VM_ASSET_RE = /^\/(vm\/dist\/(state\.bin\.gz|bzImage|rootfs\.cpio\.gz)|assets\/v86\/(v86\.wasm|libv86\.js|seabios\.bin|vgabios\.bin))$/;

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k !== VM_CACHE;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  // Skip non-GET and opaque cache-only requests that would cause errors
  if (e.request.method !== 'GET') return;
  if (e.request.cache === 'only-if-cached' && e.request.mode !== 'same-origin') return;
  // Skip cross-origin requests entirely. Re-fetching them in the SW would
  // attach credentials and produce a response that COEP=credentialless rejects;
  // letting the browser handle them directly preserves the no-cors / no-credentials
  // semantics that credentialless mode requires for CDN scripts (marked, mermaid,
  // monaco, pyodide, etc.).
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // VM assets: cache-first, opportunistically populate on miss. These files
  // are large (state.bin.gz is ~50 MB) and stable across a deploy, so the
  // cache is the right strategy. We don't pre-fetch on install — the page's
  // own fetch is the trigger, avoiding a duplicate download on first visit.
  if (VM_ASSET_RE.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then(function (cached) {
        if (cached) return cached;
        return fetch(e.request).then(function (response) {
          if (response.ok) {
            var clone = response.clone();
            caches.open(VM_CACHE).then(function (cache) {
              cache.put(e.request, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else: re-fetch with COOP/COEP injected. Headers are required
  // for crossOriginIsolated, which SharedArrayBuffer + Atomics.wait depend on.
  e.respondWith(
    fetch(e.request).then(function (response) {
      var headers = new Headers(response.headers);
      headers.set('Cross-Origin-Opener-Policy', 'same-origin');
      // credentialless is more permissive than require-corp and works with CDN assets
      headers.set('Cross-Origin-Embedder-Policy', 'credentialless');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers,
      });
    }).catch(function () {
      // Network error — fall back to normal fetch (no modification)
      return fetch(e.request);
    })
  );
});
