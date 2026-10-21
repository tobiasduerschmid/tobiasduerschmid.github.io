# TypeScript 5.9.3

Local snapshot of the compiler already pinned by the site's UML worker:

- `lib/typescript.min.js` from <https://cdn.jsdelivr.net/npm/typescript@5.9.3/lib/typescript.min.js>
- `LICENSE.txt` from <https://cdn.jsdelivr.net/npm/typescript@5.9.3/LICENSE.txt>
- `lib-map.js` packages the original `lib/lib.es2022.d.ts` and its 56 transitive
  standard-library references from the official
  [TypeScript 5.9.3 npm archive](https://registry.npmjs.org/typescript/-/typescript-5.9.3.tgz).
  Each map value preserves its upstream declaration text, including license
  headers. The wrapper exports `UMLTypeScriptLibs` in browsers and the same map
  through CommonJS. It does not include DOM declarations or learner imports.

Source repository: <https://github.com/microsoft/TypeScript/tree/v5.9.3>.
The compiler bytes match the previous integrity-checked CDN dependency.
`SHA256SUMS` records the upstream files, generated declaration map, and this
provenance note.

The declaration archive has SHA-256
`10e108c9cf7d5f2879053dff18515fb405abf2ccef63eaaf017d9c571687a1d3`.
Its bytes were also checked against the official npm registry's published
SHA-512 integrity value:
`sha512-jl1vZzPDinLr9eUt3J/t7V6FgNEw9QjvBPdysz9KfQDD41fQrC2Y4vKQdiaUpFT4bXlb1RHhLpp8wtm6M5TgSw==`.

To reproduce `lib-map.js`, download that exact archive to
`/tmp/typescript-5.9.3.tgz` and run this from the repository root:

```python
from pathlib import Path
import hashlib
import json
import re
import tarfile

archive = Path('/tmp/typescript-5.9.3.tgz')
assert hashlib.sha256(archive.read_bytes()).hexdigest() == (
    '10e108c9cf7d5f2879053dff18515fb405abf2ccef63eaaf017d9c571687a1d3')
libraries = {}
pending = ['es2022']
with tarfile.open(archive) as package:
    while pending:
        name = 'lib.' + pending.pop() + '.d.ts'
        if name in libraries:
            continue
        text = package.extractfile('package/lib/' + name).read().decode('utf-8')
        libraries[name] = text
        pending.extend(re.findall(r'<reference lib="([^"]+)"', text))

wrapper = """/* TypeScript 5.9.3 ES2022 standard library declarations. See README.md and LICENSE.txt. */
(function (root, factory) {
  'use strict';
  var libraries = factory();
  if (typeof module === 'object' && module.exports) module.exports = libraries;
  root.UMLTypeScriptLibs = libraries;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return """
output = wrapper + json.dumps(libraries, ensure_ascii=True, sort_keys=True, indent=2)
Path('js/vendor/typescript/5.9.3/lib-map.js').write_text(output + ';\n});\n')
```

UML inference parses learner source locally with the compiler API; it never
executes that source or fetches its imports. Standard-library declarations let
the compiler infer built-in operations and collection types. Preserve upstream
bytes and the license when updating this snapshot.
