/**
 * Cross-Origin Isolation Service Worker
 *
 * Injects COOP/COEP headers on all same-origin responses so that
 * SharedArrayBuffer (required by WebContainers) is available on
 * GitHub Pages and other hosts that don't support custom headers.
 *
 * Usage: register this from the tutorial-code layout when backend='webcontainer'.
 * On first registration the page is reloaded once to activate the headers.
 */
'use strict';

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (e) {
  // Skip non-GET and opaque cache-only requests that would cause errors
  if (e.request.method !== 'GET') return;
  if (e.request.cache === 'only-if-cached' && e.request.mode !== 'same-origin') return;

  e.respondWith(
    fetch(e.request).then(function (response) {
      // Only add headers to same-origin responses; cross-origin resources
      // already carry their own CORP headers (or use credentialless mode).
      if (!response.url.startsWith(self.location.origin)) return response;

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
