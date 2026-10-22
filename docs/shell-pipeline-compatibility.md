# Shell pipeline lab compatibility

The shell chapter's pipeline tutorial uses `backend: shell-pipeline` with the browser entry of **just-bash 3.6.0**, pinned in `package.json` and `package-lock.json`. It interprets shell source against an in-memory filesystem. It does not start an operating system, subprocesses, or a remote shell.

The intended contract is the chapter's text-processing and file-processing exercises, including every pipeline and redirection form taught there. The chapter also surveys operating-system tools; those are outside this runtime's capabilities. The chapter must disclose this boundary rather than describe the lab as a complete Bash installation.

## Compatibility checks

Run `node --test scripts/tests/shell-pipeline-compatibility.test.js`. These contracts import `just-bash/browser`, so excluded browser commands cannot accidentally pass through the Node entry. Each differential example has a fixed expected output and exit status; `/bin/bash` and the interpreter must both satisfy them. Fixtures are private temporary directories for native Bash and virtual files for just-bash. Sorting uses the C locale. The examples avoid differences in BSD/GNU whitespace formatting and timestamps.

These tests verify interpreter behavior under Node. The separate browser tutorial tests verify the bundled worker, loading, controls, output, and manual adapter in an actual browser.

| Chapter material | Supported behavior | Scope of verification |
| --- | --- | --- |
| Text files | `cat`; `grep` regular expressions, `-F`, `-q`, success/no-match/error statuses | Concatenation, filtering, anchored patterns, statuses 0/1/2 |
| Stream editing | `sed` substitution, first/global replacement, line addresses, `-n`, `-e`, `-E`, `-f`, `-i` | Substitution and address contracts; in-place editing verified with the pinned package |
| Field processing | `awk`, `$1`/`$2`/other fields, whitespace splitting, `-F`, `-v`, selection, actions, `END` | Field reordering, custom separator, selection, aggregation |
| Other pipeline tools | `tr`, `sort`, `uniq`, `wc`, `cut`, `comm`, `head`, `tail`, `tac`, `tee` | Translate/delete/squeeze; numeric/reverse/unique sorting; adjacent duplicates/counts; newline/word/byte counts; delimited fields; common sorted lines; slices; copy/append output |
| Files and navigation | `ls`, `cd`, `pwd`, `mkdir`, `cp`, `mv`, `rm`, `rmdir`, `touch` | Virtual tree creation, recursive copy/removal, rename, navigation; option differences below |
| Permissions and command lookup | `chmod`, `which`, `type` | Execution permission, status 126, registered command lookup |
| Environment and scripts | `export`, `source`, `.`, `bash script.sh`, `bash -c`, `echo`, `printf`, `true`, `false` | Exported child variables, current-shell sourcing, positional arguments, success/failure |
| Input and control flow | `read`, `if`/`elif`/`else`, `for`, arithmetic `for`, `while`, `case`, `local`, `return`, `exit`, `break`, `continue`, `test`, `[`, `[[ ]]`, `let` | Standard input, conditionals, numeric/string/file tests, regex conditions, loop control, function scope |
| Expansions | Single/double quotes, word splitting, variables, defaults, prefix/suffix removal, replacement, arithmetic, `$(...)`, positional arguments, brace expansion, globs | Literal versus expanded text, preserved argument boundaries, filenames and ranges |
| Pipeline syntax | `\|`, `>`, `>>`, `<`, `2>`, `2>&1`, `>&2`, `;`, `&&`, `\|\|` | Stream composition, append/overwrite, stderr separation, left-to-right duplication order, short-circuit status |
| Advanced input syntax | `<<EOF`, `<<'EOF'`, `<<<`, `<(command)`, `H < <(G) >> I` | Expanded/literal heredocs, here strings, file-like process substitution, combined input/append redirection |
| Error handling | `$?`, `set -e`, `set -o pipefail` | Last-stage status, pipeline failure, handled versus unhandled failures |

The lab's `man` command is a local documentation adapter. It must remain usable in pipelines and produce an error for unknown manual entries. It is not the host operating system's manual database.

## Known limits in the pinned browser interpreter

These are observed differences, not functionality to simulate with success-shaped output.

| Chapter feature or option | just-bash 3.6.0 browser behavior |
| --- | --- |
| `ssh`, `scp`, `wget`, `make`, `gcc`, `clang` | Not implemented. Remote access and native builds belong in the linked Linux tutorial. |
| `curl` | Requires explicit network configuration. The lab does not configure network access. |
| `tar` | Explicitly excluded from the browser command registry. |
| `python3` in the `which python3` example | Python is excluded from the browser runtime. Use a registered command such as `which grep` when experimenting in the lab. |
| `jobs`, `fg`, `bg` | Not implemented. |
| Background `&`, `wait`, `$$`, `$!`, `$BASHPID` | No real process/job-control system. `&` is accepted but executes sequentially; `wait` is a no-op. Process identifiers are virtual. Do not use this lab to infer real asynchronous job behavior. |
| `tail -f` | Rejected; only finite reads such as `tail -n 2` and `tail -n +4` are supported. |
| `cp -i`, `mv -i`, `rm -i` | Rejected; interactive confirmation prompts are unavailable. `cp`/`mv -n` are supported. |
| `mkdir -m` | Rejected. Create the directory, then use `chmod`. |
| `bash -n`, `bash -x`, `bash -v` | Treated as script filenames, not launch options. The corresponding `set -n`, `set -x`, and `set -v` shell options are available. |
| Direct script `$0` | `./script.sh` runs with an absolute virtual path in `$0`; native Bash preserves the invoked relative spelling. Arguments and execution permission still work. |
| `tac -s`, `tee -i` | Not supported. Plain `tac` reverses newline-delimited records; `tee` and `tee -a` copy/append streams. |
| `read` interactive terminal behavior | Input must be supplied through stdin, a pipe, redirection, or here string. There is no terminal session waiting for keystrokes. |
| Persistent shell sessions | Each tutorial Run creates a fresh interpreter and filesystem from the current editor files. Variables, files created by commands, functions, options, and current directory do not survive another Run. Put dependent shell statements in one run. Editor files and per-step command text use the ordinary tutorial draft persistence. |

Other differences may exist beyond the tested examples. This is a compatibility matrix for the chapter, not a claim of complete GNU Bash, GNU coreutils, sed, or awk compatibility.

## Dependency audit scope

The pinned dependency tree reports the unpatched [sprintf-js precision advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c). Its described failure is an uncaught numeric-formatting `RangeError`. In this lab's actual bundle, `printf` catches excessive floating-point precision as a command failure, while AWK's separate formatter explicitly rejects precision above 100. Width and precision are checked against formatting/output limits before allocating large results. Adapter regression tests verify controlled errors, empty output, and successful subsequent commands for excessive `printf` precision, excessive AWK precision, and oversized formatted output. These application safeguards do not remove the dependency's audit finding or establish that every possible formatter input is safe.

The tree also reports advisories through `guarded-fetch` and `undici`. Their implementations are eliminated from the browser bundle; only upstream diagnostic strings mentioning `guarded-fetch` remain. The lab supplies neither network configuration nor a fetch adapter, so network commands are not registered. Worker termination, execution budgets, and bounded output remain additional safeguards. Reassess both the dependency report and these reachable-code conclusions when rebuilding with a new package version.

## Integration notes and primary references

`_data/tutorials/shell-pipeline.yml` owns the lesson's editor files, commands,
instructions, hints, and declarative check fixtures. The ordinary tutorial
layout places a labeled **Shell command** textarea between the editor and
output. `shell_command` supplies its initial text (empty in all three practice
steps); `solution.command` replaces it
when the learner requests the solution. The editor holds `access.tsv` and
the standard Run action executes the command against those current contents.
The chapter links to the tutorial and its companion print view.

`js/tutorial-shell-pipeline.js` installs the backend methods on TutorialCode
and adapts its existing Run, Stop, Test My Work, and result controls. The
module client owns a terminable Worker; the Worker creates a new interpreter
for every request. Relative file paths resolve beneath `/home/student`, which
is also the initial working directory. `_data/shell_command_manuals.yml`
supplies the short references and `man cut`/`man sed`/`man awk` output.

Each `tests[].shell_pipeline` declares `files` (fixture overrides on the frozen
editor snapshot), `expected_stdout`, optional `comparison`, and optional
`preserve_files`. Each check uses its own fresh filesystem. `exact` compares
bytes including line endings. `count-lines` compares count/value rows in the
authored order, allowing count padding and an optional final newline.
`ranked-counts` also permits permutations of equal-count rows while requiring
numeric nonincreasing counts. All modes require status zero and empty stderr;
`preserve_files` checks the named files' contents after execution. These rules
do not inspect or prescribe a student's command text.

Hints separately inspect the parsed structure of a single pipeline through
`shell-pipeline-hints.mjs`. `pipeline_matches:` conditions match actual command
names in order; `pipeline_state:` distinguishes empty, invalid, and unsupported
structures. Analysis runs in the worker without executing commands. Comments,
quoted arguments, and redirection targets cannot impersonate stages. Scripts
with control flow or dynamic command names receive ordinary task feedback.
These conditions select advice only and never affect grading.

A batch freezes the command and current editor contents. Editing the command
or a file, changing steps, or stopping invalidates its results; old checks
cannot award credit to changed work. Run and checks never write their virtual
file changes back to Monaco. Stop terminates the Worker and the next command
starts a new one. Shell execution is limited to two seconds, 1,000 commands,
32 KiB output, and 1 MiB of file contents. A four-second host deadline per
execution also catches non-cooperative execution; initialization has a separate
15-second loading deadline.

Rebuild the self-hosted, 1.2 MiB interpreter with `npm run build:shell-lab`.
Run `node --test scripts/tests/shell-pipeline-*.test.js` and
`npx playwright test tests/shell-pipeline-tutorial.spec.js` after changes. Browser
checks cover real worker execution, cancellation, equivalence grading, file
isolation, keyboard use, paragraph-sized controls, both themes, narrow reflow,
and print. This is inspectable formative feedback, not secure exam grading.

- Import `Bash` and `defineCommand` from `just-bash/browser`; the main Node entry includes incompatible filesystem and runtime dependencies. See the [package browser export](https://github.com/vercel-labs/just-bash/blob/main/packages/just-bash/package.json) and [browser entry](https://github.com/vercel-labs/just-bash/blob/main/packages/just-bash/src/browser.ts).
- Bundle locally. The distributed browser module retains bare external imports; dropping it into a static page as an unbundled script is insufficient. Avoid accidental Node-polyfill fallbacks for unsupported commands.
- Run student programs in a terminable worker, bound execution and output, and render returned strings with `textContent`. Interpreter cancellation is cooperative; terminating the worker is the hard stop for runaway computation.
- Keep networking disabled and files in the default in-memory filesystem. See the [API and filesystem documentation](https://github.com/vercel-labs/just-bash/blob/main/packages/just-bash/README.md).
- The [command registry](https://github.com/vercel-labs/just-bash/blob/main/packages/just-bash/src/commands/registry.ts) and [browser exclusions](https://github.com/vercel-labs/just-bash/blob/main/packages/just-bash/src/commands/browser-excluded.ts) are more precise about browser support than the short package overview. Re-audit them when updating the pinned version.
