# Vendored MicroHs browser runtime

`mhs-embed.js` is an unmodified generated browser distribution from the
[MicroHs repository](https://github.com/augustss/MicroHs). It contains the
MicroHs compiler and evaluator, its Emscripten/WebAssembly runtime, the
MicroHs `base` package, and CanvHs in one self-contained JavaScript file.

## Provenance

- Upstream repository: `https://github.com/augustss/MicroHs.git`
- Upstream commit: `c473dcd181fb606a905a78a7d7518765525dd0ec`
- Commit date: 2026-07-10
- Upstream version: 0.16.5.0
- Upstream path: `web-mhs/mhs-embed.js`
- Vendored SHA-256:
  `0ac27258dbc40900c88697b48382a13602c7b22568c0cc748ef24c6e8c76acac`
- Uncompressed size: 2,621,904 bytes
- Gzip level-9 size: approximately 1,574,635 bytes (the exact byte count
  varies slightly by gzip implementation)

The upstream browser build command is:

```sh
mhs -temscripten_web -z -i -i../mhs -i../src MicroHs.Main \
  -omhs-embed.js --embed-packages base:canvhs
```

The `emscripten_web` target uses Asyncify and exports `_main`,
`_set_input_char`, `FS`, and `ccall`. It does not enable Emscripten pthreads
and therefore does not require `SharedArrayBuffer` or cross-origin isolation.

The tutorial backend only needs `base`. A future reproducible vendor refresh
may rebuild with `--embed-packages base` to reduce the payload. This copy keeps
the upstream-generated artifact intact so its provenance and checksum remain
auditable.

## License

MicroHs is Copyright 2023-2026 Lennart Augustsson. CanvHs is Copyright 2026
Lennart Augustsson. Both are distributed under Apache License 2.0. The full
license text is included in [LICENSE](LICENSE). Neither upstream repository
contains a `NOTICE` file.
