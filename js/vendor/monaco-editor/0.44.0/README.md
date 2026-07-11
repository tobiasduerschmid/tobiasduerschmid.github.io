# Monaco Editor runtime snapshot

This directory vendors the complete production AMD runtime used by SEBook's
tutorial editors.

- Package: `monaco-editor@0.44.0`
- Source archive: `https://registry.npmjs.org/monaco-editor/-/monaco-editor-0.44.0.tgz`
- npm archive integrity: `sha512-5SmjNStN6bSuSE5WPT2ZV+iYn1/yI9sd4Igtk23ChvqB7kDk9lZbB9F5frsuvpB+2njdIeGGFf2G4gbE6rCC9Q==`
- Runtime root: `min/vs/`

The whole `min/vs` tree is checked in because Monaco's AMD loader fetches
editor modules, language workers, styles, translations, and the codicon font
on demand. Vendoring only `loader.js` would leave those transitive requests
mutable.

`LICENSE` is Monaco's MIT license and `ThirdPartyNotices.txt` records the
licenses of code and assets bundled by Monaco. Both come from the same npm
archive. `SHA256SUMS` covers this README, every runtime file, and all legal
metadata; verify it from this directory with:

```sh
shasum -a 256 -c SHA256SUMS
```

When upgrading, replace this versioned directory from one exact npm archive,
regenerate `SHA256SUMS`, update every local runtime path, and run
`node --test scripts/tests/runtime-supply-chain.test.js` plus the tutorial
browser tests.
