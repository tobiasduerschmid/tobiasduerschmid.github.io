# just-bash 3.6.0 browser bundle

This static runtime is an intentional site asset for the shell pipeline lab.
It is bundled from the exact npm versions recorded in the root lockfile.

Rebuild from the repository root:

```sh
npm ci
npm run build:shell-lab
```

`scripts/build-shell-pipeline-runtime.js` bundles the official
`just-bash/browser` entry and its remaining browser dependencies. Upstream
retains static `node:zlib` imports; the build replaces those with explicit
unavailable-command errors. The lab adapter excludes compression commands.
It does not polyfill Node or enable networking, Python, or native processes.

`LICENSE` is the upstream Apache-2.0 license; `browser.mjs.LEGAL.txt` retains
the bundled dependency notices. See `docs/shell-pipeline-compatibility.md`
for the verified command surface and known differences from Bash.
