# In-memory virtual filesystem adapter

`memory-idb.js` is the unmodified `fake-indexeddb@6.2.6/auto` entry point bundled
as a minified IIFE with esbuild 0.25.12. It supplies an IndexedDB-compatible **in-memory**
store inside the opaque TLA+ runtime frame. It does not replace IndexedDB in the
SEBook page and does not persist model files. See the adjacent Apache-2.0 license.

Upstream: https://github.com/dumbmatter/fakeIndexedDB

Package: https://registry.npmjs.org/fake-indexeddb/-/fake-indexeddb-6.2.6.tgz

npm integrity:
`sha512-ihhmr0KoET51jT8R4YhbUYuLLvr1qqO6INISygtN16i8loR8kAxtAUr4+EKHTSMjL+lggaAn4OC7DRqzrNgnuQ==`

Bundled `memory-idb.js` SHA-256:
`bf3132fbc902247a82abc448383ed70380f3b25aa0585a09efd27686883e9e77`

Rebuild in a temporary directory, using the pinned package and bundler:

```sh
npm pack fake-indexeddb@6.2.6 --ignore-scripts
tar -xzf fake-indexeddb-6.2.6.tgz
npx --yes --package=esbuild@0.25.12 esbuild package/auto/index.mjs --bundle --format=iife --minify --outfile=memory-idb.js
```

The runtime's own helper frames may cache Java runtime resources on the vendor
origin. They remain separate from this in-memory model filesystem.
