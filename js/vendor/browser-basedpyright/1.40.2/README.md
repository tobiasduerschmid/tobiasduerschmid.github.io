# browser-basedpyright 1.40.2

This directory vendors the unmodified browser worker published in the MIT-licensed
[`browser-basedpyright@1.40.2`](https://www.npmjs.com/package/browser-basedpyright/v/1.40.2)
package. It includes the upstream type checker and its bundled typeshed stubs.

- Upstream: <https://github.com/DetachHead/basedpyright/tree/main/packages/browser-pyright>
- Archive: <https://registry.npmjs.org/browser-basedpyright/-/browser-basedpyright-1.40.2.tgz>
- Archive SHA-256: `d68988efe958e3a34e3c6109cf5cf261a6ce6621277d566a64050736ac633c3f`
- Vendored files: `dist/pyright.worker.js` and `LICENSE.txt` from the archive.
- Worker size: 17,982,887 bytes. The development source map is not needed at runtime and is omitted.

`js/uml-python-types.js` verifies the worker's SHA-256 before creating any worker.
The client uses the Language Server Protocol and the upstream browser worker boot
protocol; it does not patch or import private checker internals. Updating the
package requires updating both this checksum manifest and the adapter's pinned
hash, then running the Python inference integration tests.

To reproduce the vendored bytes, download the pinned archive above, extract it
outside the repository, and compare `package/dist/pyright.worker.js` and
`package/LICENSE.txt` with this directory. Run `shasum -a 256 -c SHA256SUMS` from
this directory to verify the stored files.

The upstream browser edition is experimental outside its own playground. The
site tests the required behavior against this exact build rather than fetching
the latest package at runtime. No learner source is sent to a remote service;
all analysis uses an in-memory filesystem in local Web Workers.
