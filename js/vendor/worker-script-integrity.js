/*
 * Integrity-checked imports for classic Web Workers.
 *
 * WorkerGlobalScope.importScripts() has no Subresource Integrity parameter.
 * This adapter downloads a pinned script as bytes, verifies its SHA-256 digest,
 * and only then evaluates it from a same-process Blob URL. A changed CDN
 * response therefore fails closed before any third-party code executes.
 */
(function (scope) {
  'use strict';

  var DEPENDENCIES = Object.freeze({
    acorn: Object.freeze({
      url: 'https://cdn.jsdelivr.net/npm/acorn@8.14.0/dist/acorn.min.js',
      sha256: '1260ca6ecfaace00fbef15597fb0f06d4ea357eb07307828569991197a203369'
    }),
    isomorphicGit: Object.freeze({
      url: 'https://cdn.jsdelivr.net/npm/isomorphic-git@1.27.1/index.umd.min.js',
      sha256: '4377c9fd608ecea01782ae1bd3bf7cb15121b7c6069af046a6431b2561e682e7'
    }),
    sqlJs: Object.freeze({
      url: 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.js',
      sha256: '558a72c3ab3415d0e6d243cfd23f9d61543600d59054b4b7b8da3cd65f6b9fd4'
    }),
    sqlWasm: Object.freeze({
      url: 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.wasm',
      sha256: 'd7e61b828523001f26ce0b3f88dabcf6c12e5e6edf80eb4f08b26ac7b946ff88'
    }),
    tauPrologCore: Object.freeze({
      url: 'https://cdn.jsdelivr.net/npm/tau-prolog@0.3.4/modules/core.js',
      sha256: '696c4117abffb1d11ac56f17727ee5790785ece21e8da66573449b016d8016a5'
    }),
    tauPrologLists: Object.freeze({
      url: 'https://cdn.jsdelivr.net/npm/tau-prolog@0.3.4/modules/lists.js',
      sha256: '6268ac8c67b2f5c20134a8b6717e63db80aef17ba32e851107cbc8e5eb8adf42'
    }),
    typescript: Object.freeze({
      url: 'https://cdn.jsdelivr.net/npm/typescript@5.9.3/lib/typescript.min.js',
      sha256: '8197e57fa5e1d7f6521f3a2f6a32565196e4e59c092cdc2a9c3206b98ef57ddf'
    })
  });

  var SHA256_CONSTANTS = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  function rotateRight(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  function sha256Hex(bytes) {
    if (!(bytes instanceof Uint8Array)) {
      throw new TypeError('sha256Hex expects a Uint8Array');
    }

    var paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
    var padded = new Uint8Array(paddedLength);
    padded.set(bytes);
    padded[bytes.length] = 0x80;

    var paddedView = new DataView(padded.buffer);
    var bitLengthHigh = Math.floor(bytes.length / 0x20000000);
    var bitLengthLow = (bytes.length * 8) >>> 0;
    paddedView.setUint32(paddedLength - 8, bitLengthHigh, false);
    paddedView.setUint32(paddedLength - 4, bitLengthLow, false);

    var hash = new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ]);
    var words = new Uint32Array(64);

    for (var offset = 0; offset < paddedLength; offset += 64) {
      for (var wordIndex = 0; wordIndex < 16; wordIndex++) {
        words[wordIndex] = paddedView.getUint32(offset + wordIndex * 4, false);
      }
      for (wordIndex = 16; wordIndex < 64; wordIndex++) {
        var previous15 = words[wordIndex - 15];
        var previous2 = words[wordIndex - 2];
        var sigma0 = rotateRight(previous15, 7) ^ rotateRight(previous15, 18) ^ (previous15 >>> 3);
        var sigma1 = rotateRight(previous2, 17) ^ rotateRight(previous2, 19) ^ (previous2 >>> 10);
        words[wordIndex] = (words[wordIndex - 16] + sigma0 + words[wordIndex - 7] + sigma1) >>> 0;
      }

      var a = hash[0];
      var b = hash[1];
      var c = hash[2];
      var d = hash[3];
      var e = hash[4];
      var f = hash[5];
      var g = hash[6];
      var h = hash[7];

      for (wordIndex = 0; wordIndex < 64; wordIndex++) {
        var upperSigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
        var choice = (e & f) ^ (~e & g);
        var temporary1 = (h + upperSigma1 + choice + SHA256_CONSTANTS[wordIndex] + words[wordIndex]) >>> 0;
        var upperSigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
        var majority = (a & b) ^ (a & c) ^ (b & c);
        var temporary2 = (upperSigma0 + majority) >>> 0;

        h = g;
        g = f;
        f = e;
        e = (d + temporary1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temporary1 + temporary2) >>> 0;
      }

      hash[0] = (hash[0] + a) >>> 0;
      hash[1] = (hash[1] + b) >>> 0;
      hash[2] = (hash[2] + c) >>> 0;
      hash[3] = (hash[3] + d) >>> 0;
      hash[4] = (hash[4] + e) >>> 0;
      hash[5] = (hash[5] + f) >>> 0;
      hash[6] = (hash[6] + g) >>> 0;
      hash[7] = (hash[7] + h) >>> 0;
    }

    var result = '';
    for (var hashIndex = 0; hashIndex < hash.length; hashIndex++) {
      result += hash[hashIndex].toString(16).padStart(8, '0');
    }
    return result;
  }

  function downloadBytes(url) {
    var request = new XMLHttpRequest();
    request.open('GET', url, false);
    request.responseType = 'arraybuffer';
    request.send(null);
    if (request.status < 200 || request.status >= 300 || !request.response) {
      throw new Error('Could not download pinned worker dependency: ' + url);
    }
    return new Uint8Array(request.response);
  }

  var loaded = Object.create(null);
  var verifiedBytes = Object.create(null);

  function downloadDependency(name) {
    var dependency = DEPENDENCIES[name];
    if (!dependency) throw new Error('Unknown worker dependency: ' + name);
    if (verifiedBytes[name]) return verifiedBytes[name].slice();

    var bytes = downloadBytes(dependency.url);
    var actualSha256 = sha256Hex(bytes);
    if (actualSha256 !== dependency.sha256) {
      throw new Error(
        'Integrity check failed for worker dependency "' + name + '": expected ' +
        dependency.sha256 + ', received ' + actualSha256
      );
    }
    verifiedBytes[name] = bytes;
    return bytes.slice();
  }

  function importDependency(name) {
    if (loaded[name]) return;
    var bytes = downloadDependency(name);

    var blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'text/javascript' }));
    try {
      importScripts(blobUrl);
      loaded[name] = true;
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  }

  scope.SEBookWorkerScriptIntegrity = Object.freeze({
    dependencies: DEPENDENCIES,
    downloadDependency: downloadDependency,
    importDependency: importDependency,
    sha256Hex: sha256Hex
  });
})(typeof self !== 'undefined' ? self : globalThis);
