# Vendored MicroHs browser runtime

`mhs-embed.js` packages the generated browser distribution from the
[MicroHs repository](https://github.com/augustss/MicroHs). It contains the
MicroHs compiler and evaluator, its Emscripten/WebAssembly runtime, the
MicroHs `base` package, and CanvHs in one self-contained JavaScript file.

## Provenance

- Upstream repository: `https://github.com/augustss/MicroHs.git`
- Upstream commit: `9e8f923c614c12f14412e63e329de25ff9309c4f`
- Commit date: 2026-08-29
- Upstream version: 0.16.6.0
- Upstream paths: `web-mhs/mhs-embed.js`, `web-mhs/mhs-embed.wasm`
- Upstream JavaScript SHA-256:
  `b8e57dcad9d060f7b4a80654008c08ef1ed4fef9cb5c95bc6201feecc2319770`
- Upstream WebAssembly SHA-256:
  `89131e819c615f96a964a78958a6bb5c3a9d42b6c95cdf306f143231c0270919`
- Vendored SHA-256:
  `4fcc8fb12f2d5e1b62a483af2073e937f04c20a98d6757045c62d09068528e47`
- Uncompressed size: 2,596,069 bytes
- Gzip level-9 size: approximately 1,401,005 bytes (the exact byte count
  varies slightly by gzip implementation)

The upstream browser build command is:

```sh
mhs -temscripten_web -z -i -i../mhs -i../src MicroHs.Main \
  -omhs-embed.js --embed-packages base:canvhs
```

The `emscripten_web` target uses Asyncify and exports `_main`,
`_set_input_char`, `FS`, and `ccall`. It does not enable Emscripten pthreads
and therefore does not require `SharedArrayBuffer` or cross-origin isolation.

The 0.16.6.0 interpreter translates expressions through the runtime's
deserializer. In local Chrome measurements this reduced a small module's
Run/test latency from about 2.2 seconds to 1.5 seconds, with the same adapter
and fresh reload before every request. These are sample measurements, not a
cross-device performance guarantee.

## Reproduce the single-file package

Upstream now ships the JavaScript loader and Wasm separately. The tutorial's
opaque-origin sandbox cannot fetch that Wasm from the site without CORS
headers. We prepend one assignment to Emscripten's documented `wasmBinary`
input, embedding the **unchanged** Wasm bytes as base64. The upstream loader
then follows byte-for-byte. This keeps loading local and self-contained,
without changing the sandbox, server headers, or compiler behavior.

Given a MicroHs checkout at the pinned commit, run this from the site root
(replace `../MicroHs` with that checkout's path):

```sh
python3 - ../MicroHs <<'PY'
import base64
import hashlib
from pathlib import Path
import sys

source = Path(sys.argv[1]) / 'web-mhs'
loader = (source / 'mhs-embed.js').read_bytes()
wasm = (source / 'mhs-embed.wasm').read_bytes()
for data, expected in [
    (loader, 'b8e57dcad9d060f7b4a80654008c08ef1ed4fef9cb5c95bc6201feecc2319770'),
    (wasm, '89131e819c615f96a964a78958a6bb5c3a9d42b6c95cdf306f143231c0270919'),
]:
    if hashlib.sha256(data).hexdigest() != expected:
        raise SystemExit('Upstream artifact does not match the pinned build')
prelude = (b'globalThis.Module.wasmBinary = Uint8Array.from(atob("'
           + base64.b64encode(wasm)
           + b'"), function (c) { return c.charCodeAt(0); });\n')
Path('js/vendor/microhs/mhs-embed.js').write_bytes(prelude + loader)
PY
```

`scripts/tests/runtime-supply-chain.test.js` verifies both upstream payloads
and the complete packaged bundle. The tutorial backend only needs `base`; a
future reproducible rebuild may omit CanvHs to reduce the payload further.

## License

MicroHs is Copyright 2023-2026 Lennart Augustsson. CanvHs is Copyright 2026
Lennart Augustsson. Both are distributed under Apache License 2.0. The full
license text is included in [LICENSE](LICENSE). Neither upstream repository
contains a `NOTICE` file.
