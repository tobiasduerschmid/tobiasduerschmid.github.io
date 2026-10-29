# TLA+ browser runtime provenance

`tla2tools.jar` is the **unmodified official upstream artifact**, retrieved from
<https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar> on 2026-10-29.
This is the rolling Clarke prerelease, pinned by bytes rather than the movable release tag.

- GitHub release asset ID: `683491413`.
- Upstream publication: 2026-10-28.
- Embedded build timestamp: `2026-10-28T01:45:57.306Z`.
- Embedded source revision: `56d37a9b7bf529086fd961160e0b8975e224eafc`.
- SHA-256: `fc6878c603f0fdc18b9fe3e5bf51860cb90ab5b1154e3c371660c036d6bdd63e`.
- Source: <https://github.com/tlaplus/tlaplus/tree/56d37a9b7bf529086fd961160e0b8975e224eafc>.
- License: `LICENSE-TLAPLUS.txt` (MIT).

The 1.7.4 stable release was unsuitable for this browser integration: its local fingerprint
set inherits `UnicastRemoteObject`, opening an RMI socket even for local checking. The
pinned upstream revision removes that inheritance. No checker or language semantics were
patched for this site.

`sebook-tla-bridge.jar` is the intentional browser deliverable built from `tla/src/` using
`tla/build.py` and Java's `--release 11`. The build uses fixed ZIP timestamps and sorted
entries. Its current checksum is in `SHA256SUMS`; the browser manifest must be updated
after a rebuild. The bridge disables desktop JMX monitoring through its own
`MBeanServerBuilder`, leaving the upstream checker unchanged.
It also uses the upstream Java-override registration API to observe calls to
`TLCSet("exit", TRUE)` and delegate them to the original implementation, so an
early exit cannot be presented as exhaustive verification.

The bridge uses Gson 2.14.0 already bundled in the pinned upstream tools JAR. It does
not bundle a second Gson version or download build dependencies. Upstream's dependency
version is recorded in its [pom.xml](https://github.com/tlaplus/tlaplus/blob/56d37a9b7bf529086fd961160e0b8975e224eafc/tlatools/org.lamport.tlatools/pom.xml).
Gson is copyright Google Inc., under Apache License 2.0 (`LICENSE-GSON.txt`).

CheerpJ 4.3 is a separately hosted runtime; it is **not** redistributed in these JARs.
Its community license and self-hosting terms are documented at
<https://cheerpj.com/docs/licensing>. The bridge was implemented against the official
engine APIs; no code from the unlicensed browser-wrapper prototypes was copied.
