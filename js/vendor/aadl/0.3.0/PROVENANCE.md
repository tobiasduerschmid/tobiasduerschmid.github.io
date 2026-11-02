# Pinned OSATE browser artifacts

Source: the official [osate-cli 0.3.0 release](https://github.com/osate/aadl-tooling/releases/tag/osate-cli-v0.3.0),
published September 29, 2026. The
[macOS ARM64 archive](https://github.com/osate/aadl-tooling/releases/download/osate-cli-v0.3.0/osate-cli-0.3.0-macos-arm64.tar.gz)
has SHA-256 `d11fa193e88f505240ac74b19ce0f33f43010c4a3350fd1b8f361a5fbc0bef5e`.

The shipped engine identifies itself as OSATE **2.21.0-SNAPSHOT (b8308b7)**,
language server **0.3.0 (895e0b9)**. The separate stable OSATE 2.20.0 version
is not this binary's identity.

The 51 upstream JARs here are byte-for-byte copies from that archive. The selected
closure supports the tutorial's parser, validation, instantiation, instance
projection, and latency path. It was reduced from the 173-JAR distribution and
checked with the real native and browser cases; it is not a new AADL parser.
Checksums and sizes are locked in `aadl/dependencies.json` at the repository root.
The native JRE, CLI process/server launcher, and unused desktop plugins are not
browser artifacts.

`sebook-aadl-bridge.jar` is built from `aadl/src` by `aadl/build.py`, using
`javac --release 21`. `SHA256SUMS` includes it. Its Java 25/CheerpJ compatibility
adapter is documented in `aadl/README.md`.

OSATE and its language server are licensed under EPL-2.0. The official
distribution's `LICENSE.txt` and `COPYRIGHT` are preserved as
`LICENSE-UPSTREAM.txt` and `COPYRIGHT-UPSTREAM.txt`; individual unchanged JARs
retain their own license and notice resources. The CLI project has separate
BSD-style terms, and third-party libraries retain their respective licenses.
See the [upstream license overview](https://github.com/osate/aadl-tooling/blob/osate-cli-v0.3.0/LICENSE.md).

CheerpJ is loaded separately from the official versioned CDN and is not included
in these JARs. Its [educational/community licensing and attribution terms](https://cheerpj.com/docs/licensing)
apply separately; this artifact set does not grant self-hosting or commercial
rights to CheerpJ.
