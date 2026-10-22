const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const fixtures = {
  'server.log': '08:00  INFO  alice login\n08:01  ERROR bob timeout\n08:02  INFO  alice retry\n08:03  ERROR alice disk\n08:04  WARN  bob slow\n',
  'names.txt': 'charlie\nalice\nbob\nalice\n',
  'people.txt': 'alice:Lovelace\nada:King\ngrace:Hopper\n',
  'a.txt': 'alice\nbob\ncharlie\n',
  'b.txt': 'alice\ncharlie\ndave\n',
  'env.sh': 'export LAB_VALUE=ready\n',
  'script.sh': 'printf "%s:%s:%s\\n" "$0" "$#" "$1"\n',
  'executable.sh': 'echo "$1"\n',
};

// These examples avoid platform-specific output formatting (BSD vs GNU),
// locale-dependent sorting, current timestamps, and host filesystem paths.
const examples = [
  ['cat concatenates named files', 'cat a.txt b.txt', 'alice\nbob\ncharlie\nalice\ncharlie\ndave\n'],
  ['grep filters matching lines through a pipe', 'cat server.log | grep ERROR', '08:01  ERROR bob timeout\n08:03  ERROR alice disk\n'],
  ['grep fixed strings do not interpret regex metacharacters', 'printf "a.b\\naxb\\n" | grep -F "a.b"', 'a.b\n'],
  ['grep regular expressions match line anchors', 'printf "alice\\nalice2\\nbob\\n" | grep "^[a-z]*$"', 'alice\nbob\n'],
  ['grep distinguishes no match from a missing input', 'grep WARN names.txt; echo $?; grep ERROR missing.txt 2>/dev/null; echo $?', '1\n2\n'],
  ['sed replaces the first occurrence on each line', "printf 'ERROR ERROR\\nERROR\\n' | sed 's/ERROR/FAIL/'", 'FAIL ERROR\nFAIL\n'],
  ['sed global substitution replaces every occurrence', "printf 'ERROR ERROR\\n' | sed 's/ERROR/FAIL/g'", 'FAIL FAIL\n'],
  ['sed addresses and quiet mode select lines', "sed -n '2,3p' names.txt", 'alice\nbob\n'],
  ['awk reads whitespace fields and swaps their order', "awk '{print $3, $2}' server.log", 'alice INFO\nbob ERROR\nalice INFO\nalice ERROR\nbob WARN\n'],
  ['awk accepts a custom field separator', "awk -F: '{print $2, $1}' people.txt", 'Lovelace alice\nKing ada\nHopper grace\n'],
  ['awk filters records before printing selected fields', "awk '$2 == \"ERROR\" {print $3}' server.log", 'bob\nalice\n'],
  ['awk counts matching records with an END action', "awk '$2 == \"ERROR\" {n++} END {print n}' server.log", '2\n'],
  ['tr translates, deletes, and squeezes characters from stdin', "printf 'hello   world\\n' | tr 'a-z' 'A-Z' | tr -s ' ' | tr -d 'EO'", 'HLL WRLD\n'],
  ['sort orders numbers and reverses the result', "printf '2\\n10\\n1\\n' | sort -nr", '10\n2\n1\n'],
  ['uniq collapses only adjacent duplicates', 'uniq names.txt', 'charlie\nalice\nbob\nalice\n'],
  ['sort and uniq build a frequency table', "sort names.txt | uniq -c | awk '{print $1, $2}'", '2 alice\n1 bob\n1 charlie\n'],
  ['sort -u removes duplicate lines', 'sort -u names.txt', 'alice\nbob\ncharlie\n'],
  ['wc counts newlines, words, and bytes', "printf 'one two\\nthree\\n' | wc | awk '{print $1, $2, $3}'", '2 3 14\n'],
  ['cut selects delimited fields and ranges', 'cut -d: -f1 people.txt; cut -d: -f1-2 people.txt', 'alice\nada\ngrace\nalice:Lovelace\nada:King\ngrace:Hopper\n'],
  ['comm selects lines common to two sorted inputs', 'comm -12 a.txt b.txt', 'alice\ncharlie\n'],
  ['head and tail select a slice of a file', 'head -n 3 names.txt | tail -n 2; tail -n +4 names.txt', 'alice\nbob\nalice\n'],
  ['tee writes and appends while forwarding stdout', 'echo first | tee saved.txt; echo second | tee -a saved.txt; cat saved.txt', 'first\nsecond\nfirst\nsecond\n'],
  ['redirection overwrites, appends, and supplies stdin', 'echo first > saved.txt; echo second >> saved.txt; cat < saved.txt', 'first\nsecond\n'],
  ['redirection opens an output file before a command reads it', 'sort names.txt > names.txt; cat names.txt', ''],
  ['stderr can be captured separately from stdout', 'emit() { echo output; echo diagnostic >&2; }; emit >out.txt 2>err.txt; cat out.txt err.txt', 'output\ndiagnostic\n'],
  ['stderr duplication respects left-to-right redirection order', 'emit() { echo output; echo diagnostic >&2; }; emit 2>&1 >out.txt; cat out.txt; emit >both.txt 2>&1; cat both.txt', 'diagnostic\noutput\noutput\ndiagnostic\n'],
  ['an unquoted heredoc expands variables', 'name=Ada\ncat <<EOF\nHello $name\nEOF', 'Hello Ada\n'],
  ['a quoted heredoc preserves literal dollar signs', "name=Ada\ncat <<'EOF'\nHello $name\nEOF", 'Hello $name\n'],
  ['here strings feed a command and add a newline', 'grep ERROR <<< "08:15 ERROR timeout"', '08:15 ERROR timeout\n'],
  ['process substitution supplies input to a pipeline', 'comm -12 <(sort a.txt) <(sort b.txt)', 'alice\ncharlie\n'],
  ['process substitution combines with stdin and append redirection', 'cat < <(grep ERROR server.log) >>errors.txt; cat errors.txt', '08:01  ERROR bob timeout\n08:03  ERROR alice disk\n'],
  ['pipeline status comes from its last stage by default', 'false | true; echo $?; set -o pipefail; false | true; echo $?', '0\n1\n'],
  ['AND and OR chains short-circuit according to status', 'false && echo skip; false || echo rescue; true && echo success; true || echo skip', 'rescue\nsuccess\n'],
  ['errexit stops at an unhandled failure', 'set -e; false || echo rescue; echo before; false; echo unreachable', 'rescue\nbefore\n', 1],
  ['quotes preserve spaces and prevent unwanted expansion', "name=Ada; printf '%s\\n' '$name' \"$name\"; FILE='my report.pdf'; printf '<%s>\\n' \"$FILE\" $FILE", '$name\nAda\n<my report.pdf>\n<my>\n<report.pdf>\n'],
  ['parameter expansion supplies defaults and changes strings', 'unset NAME; echo "${NAME:=anonymous}"; path=/home/user/main.sh; file=${path##*/}; echo "${file%.*}"; msg="World World"; echo "${msg/World/Earth}" "${msg//World/Earth}"', 'anonymous\nmain\nEarth World Earth Earth\n'],
  ['command substitution and arithmetic compose', 'count=$(grep ERROR server.log | wc -l); echo "$((count + 3))"', '5\n'],
  ['functions use local variables and preserve argument boundaries', 'name=outer; greet() { local name="$1"; echo "$name:$#"; }; greet "Ada Lovelace"; echo "$name"', 'Ada Lovelace:1\nouter\n'],
  ['source and dot execute in the current environment', 'source env.sh; echo "$LAB_VALUE"; unset LAB_VALUE; . env.sh; echo "$LAB_VALUE"', 'ready\nready\n'],
  ['bash executes files with positional parameters', 'bash script.sh "two words" extra', 'script.sh:2:two words\n'],
  ['read consumes provided stdin', 'read -r name; echo "Hello $name"', 'Hello Ada Lovelace\n', 0, 'Ada Lovelace\n'],
  ['tests and branching select the matching clause', 'x=3; if [ "$x" -gt 5 ]; then echo high; elif [ "$x" -eq 3 ]; then echo equal; else echo low; fi; [[ abc123 =~ ^[a-z]+[0-9]+$ ]] && echo match', 'equal\nmatch\n'],
  ['loops support continue and break', 'for ((i=1; i<=5; i++)); do [ "$i" -eq 2 ] && continue; [ "$i" -eq 4 ] && break; echo "$i"; done', '1\n3\n'],
  ['while loops and case dispatch use shell status', 'i=0; while [ "$i" -lt 2 ]; do echo "$i"; i=$((i+1)); done; command=stop; case "$command" in start) echo start;; stop) echo stopped;; *) echo unknown;; esac', '0\n1\nstopped\n'],
  ['brace expansion and globbing generate file names', 'mkdir -p project/{src,tests,docs}; touch project/src/{a,b}.log; printf "%s\\n" project/src/*.log; echo {1..3}', 'project/src/a.log\nproject/src/b.log\n1 2 3\n'],
  ['file commands copy, move, remove, and navigate a virtual tree', 'mkdir -p work/src; touch work/src/empty; cp -r work/src work/backup; mv work/backup/empty work/renamed; cd work; test -f renamed && echo moved; rm -r backup; rmdir src 2>/dev/null || echo nonempty; rm src/empty; rmdir src; cd ..; test -d work && echo parent', 'moved\nnonempty\nparent\n'],
  ['a script without execute permission returns status 126', './executable.sh first 2>/dev/null; echo $?', '126\n'],
  ['chmod grants execute permission to a script', 'chmod u+x executable.sh; ./executable.sh first', 'first\n'],
  ['which and type locate registered commands', 'which grep | sed "s@.*/@@"; type -t grep; type -t cd; type -t [', 'grep\nfile\nbuiltin\nbuiltin\n'],
  ['a subshell isolates its variable assignments', 'name=outer; (name=inner; echo "$name"); echo "$name"', 'inner\nouter\n'],
];

function runNativeBash(script, stdin) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'shell-pipeline-compatibility-'));
  try {
    for (const [name, contents] of Object.entries(fixtures)) {
      fs.writeFileSync(path.join(cwd, name), contents, { mode: 0o600 });
    }
    return spawnSync('/bin/bash', ['--noprofile', '--norc', '-c', script], {
      cwd,
      env: { PATH: '/usr/bin:/bin', LC_ALL: 'C', TZ: 'UTC', HOME: cwd },
      input: stdin,
      encoding: 'utf8',
      timeout: 5000,
    });
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}

for (const [behavior, script, stdout, exitCode = 0, stdin = ''] of examples) {
  test(`browser shell: ${behavior}`, async () => {
    const native = runNativeBash(script, stdin);
    assert.equal(native.error, undefined, 'native Bash must complete');
    assert.equal(native.stdout, stdout, 'the teaching example must agree with native Bash');
    assert.equal(native.status, exitCode, 'the expected status must agree with native Bash');

    const { Bash } = await import('just-bash/browser');
    const files = Object.fromEntries(Object.entries(fixtures).map(([name, contents]) => [`/lab/${name}`, contents]));
    const shell = new Bash({ files, cwd: '/lab', env: { LC_ALL: 'C', TZ: 'UTC' } });
    const result = await shell.exec(script, { stdin, rawScript: true });
    assert.equal(result.stdout, stdout, 'the browser shell must produce the taught output');
    assert.equal(result.exitCode, exitCode, 'the browser shell must preserve shell exit status');
    assert.equal(result.stderr, native.stderr, 'the browser shell must preserve diagnostic output');
  });
}

async function createLabShell() {
  const { createShell } = await import('../../js/shell-pipeline-runtime.mjs');
  const manuals = yaml.load(fs.readFileSync(path.join(__dirname, '../../_data/shell_command_manuals.yml'), 'utf8'));
  return { shell: createShell({ files: {}, manuals }), manuals };
}

for (const command of ['cut', 'sed', 'awk']) {
  test(`lab man prints the authored ${command} manual`, async () => {
    const { shell, manuals } = await createLabShell();
    const result = await shell.exec(`man ${command}`);
    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, '');
    assert.equal(result.stdout, manuals[command]);
    assert.match(result.stdout, /^NAME\n/);
    assert.match(result.stdout, /\nSYNOPSIS\n/);
    assert.match(result.stdout, /\nDESCRIPTION\n/);
    assert.match(result.stdout, /\nOPTIONS\n/);
  });
}

test('lab man output composes with pipes and redirection', async () => {
  const { shell, manuals } = await createLabShell();
  const result = await shell.exec('man sed | head -n 2 > manual.txt; cat manual.txt');
  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, '');
  assert.equal(result.stdout, `${manuals.sed.split('\n').slice(0, 2).join('\n')}\n`);
});

test('lab man uses built-in help for another supported command', async () => {
  const { shell } = await createLabShell();
  const result = await shell.exec('man grep');
  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /grep/);
  assert.match(result.stdout, /Usage:|usage:/);
});

for (const command of ['not-a-command', 'constructor', '__proto__']) {
  test(`lab man rejects the unknown entry ${command}`, async () => {
    const { shell } = await createLabShell();
    const result = await shell.exec(`man ${command}`);
    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /no lab manual/);
  });
}

for (const script of ['man', 'man sed awk']) {
  test(`lab manual lookup requires one name: ${script}`, async () => {
    const { shell } = await createLabShell();
    const result = await shell.exec(script);
    assert.equal(result.exitCode, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Usage: man COMMAND/);
  });
}

for (const [behavior, command, diagnostic] of [
  ['excessive printf precision fails without disabling the shell', "printf '%.101f' 1", /printf.*(?:precision|digits)/i],
  ['excessive awk precision fails without disabling the shell', "awk 'BEGIN {printf \"%.101f\", 1}'", /awk.*precision/i],
  ['oversized formatted output fails before reaching the display', "printf '%33000s' x", /(?:width|output).*limit/i],
]) {
  test(`lab resource limit: ${behavior}`, async () => {
    const { shell } = await createLabShell();
    const failure = await shell.exec(command);
    assert.equal(Number.isInteger(failure.exitCode), true);
    assert.notEqual(failure.exitCode, 0);
    assert.equal(failure.stdout, '');
    assert.match(failure.stderr, diagnostic);

    const recovery = await shell.exec('echo ready');
    assert.equal(recovery.exitCode, 0);
    assert.equal(recovery.stderr, '');
    assert.equal(recovery.stdout, 'ready\n');
  });
}
