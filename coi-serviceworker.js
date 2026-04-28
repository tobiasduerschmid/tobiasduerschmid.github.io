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
 * VM assets are cached in Cache Storage but revalidated against the server's
 * validators before use. This keeps repeat visits fast without relying on
 * manual cache-key bumps whenever state.bin.gz / rootfs / kernel changes.
 */
'use strict';

var VM_CACHE = 'vm-assets-v2';

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

function validatorHeaders(response) {
  if (!response) return {};
  return {
    etag: response.headers.get('ETag') || response.headers.get('etag') || '',
    lastModified: response.headers.get('Last-Modified') || response.headers.get('last-modified') || '',
    length: response.headers.get('Content-Length') || response.headers.get('content-length') || '',
  };
}

function sameValidators(cached, fresh) {
  var a = validatorHeaders(cached);
  var b = validatorHeaders(fresh);
  if (a.etag && b.etag) return a.etag === b.etag;
  if (a.lastModified && b.lastModified) {
    if (a.lastModified !== b.lastModified) return false;
    return !a.length || !b.length || a.length === b.length;
  }
  return false;
}

function requestWithMethod(request, method, headers) {
  return new Request(request.url, {
    method: method,
    headers: headers || request.headers,
    cache: 'no-store',
    credentials: request.credentials,
    mode: request.mode,
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
  });
}

function fetchAndCacheVMAsset(cache, request) {
  return fetch(requestWithMethod(request, 'GET')).then(function (response) {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
}

function conditionalFetchVMAsset(cache, request, cached) {
  var headers = new Headers(request.headers);
  var validators = validatorHeaders(cached);
  if (validators.etag) headers.set('If-None-Match', validators.etag);
  if (validators.lastModified) headers.set('If-Modified-Since', validators.lastModified);

  return fetch(requestWithMethod(request, 'GET', headers)).then(function (response) {
    if (response.status === 304 && cached) return cached;
    if (response.ok) {
      cache.put(request, response.clone());
      return response;
    }
    return cached || response;
  });
}

function handleVMAssetRequest(request) {
  return caches.open(VM_CACHE).then(function (cache) {
    return cache.match(request).then(function (cached) {
      if (!cached) return fetchAndCacheVMAsset(cache, request);

      return fetch(requestWithMethod(request, 'HEAD')).then(function (headResponse) {
        if (headResponse.ok && sameValidators(cached, headResponse)) return cached;
        if (headResponse.ok) return fetchAndCacheVMAsset(cache, request);
        return conditionalFetchVMAsset(cache, request, cached);
      }).catch(function () {
        return conditionalFetchVMAsset(cache, request, cached)
          .catch(function () { return cached; });
      });
    });
  });
}

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

  // VM assets: Cache Storage with cheap validator checks. The snapshot is
  // large enough that browser HTTP cache policy alone is not reliable, but a
  // pure cache-first strategy can keep serving obsolete VM states after a
  // deploy. HEAD avoids downloading the body when cached bytes are current;
  // conditional GET is the standards-compliant fallback if HEAD is unavailable.
  if (VM_ASSET_RE.test(url.pathname)) {
    e.respondWith(handleVMAssetRequest(e.request));
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
