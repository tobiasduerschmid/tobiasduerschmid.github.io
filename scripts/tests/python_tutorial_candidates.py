"""Stable sample submissions for the Python tutorial's grading contracts.

Run through python-tutorial-graders.test.js (npm run test:unit). The Node entry
point parses YAML and supplies JSON, so this runner needs only Python's stdlib.
Fixtures intentionally live separately from the published solutions: changing a
grader or model answer must not silently change the regression submissions.
Each candidate explicitly declares acceptance or rejection. Rejected candidates
also name the expected error type so incidental runtime errors cannot pass.
"""
import ast
from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures/python-tutorial"
CASES = []


def sol(filename):
    return (FIXTURES / filename).read_text()


def add(filename, name, source, *, expected, rejection_type="AssertionError"):
    assert expected in ("accept", "reject"), f"Invalid expected outcome: {expected}"
    # A broken or ineffective fixture must never masquerade as a semantic check.
    compile(source, filename, "exec")
    assert source != sol(filename), f"No-op regression fixture: {name}"
    CASES.append((filename, name, source, expected, rejection_type))


def variant(filename, name, transform, *, expected, rejection_type="AssertionError"):
    add(
        filename, name, transform(sol(filename)),
        expected=expected, rejection_type=rejection_type,
    )


def replacefn(source, name, replacement):
    tree = ast.parse(source)
    node = next(
        node for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name == name
    )
    lines = source.splitlines(True)
    return (
        "".join(lines[:node.lineno - 1])
        + replacement + "\n"
        + "".join(lines[node.end_lineno:])
    )


variant(
    'profile.py',
    'wrong GPA precision',
    lambda source: source.replace('GPA: {gpa:.2f}', 'GPA: {gpa:.3f}'),
    expected='reject',
)

variant(
    'profile.py',
    'wrong missing GPA label',
    lambda source: source.replace('GPA: {gpa:.2f}', '{gpa:.2f}'),
    expected='reject',
)

variant(
    'profile.py',
    'fields emitted on separate lines',
    lambda source: source.replace(' | ', '\\n'),
    expected='reject',
)

variant(
    'profile.py',
    'correct alternate f-string quotes',
    lambda source: (
        source.replace(
            'print(f"Student: {name} | Year: {year} | Major: {major} | GPA: {gpa:.2f}")',
            "print(f'Student: {name} | Year: {year} | Major: {major} | GPA: {gpa:.2f}')",
        )
    ),
    expected='accept',
)

variant(
    'reference_names.py',
    'equivalent explicit addition',
    lambda source: (
        source.replace('title +=', 'title = title +').replace(
            'capacity +=',
            'capacity = capacity +',
        )
    ),
    expected='accept',
)

variant(
    'grades.py',
    'drops failing score',
    lambda source: source.replace('    else:\n        print(f"Score {score}: F")', ''),
    expected='reject',
)

variant(
    'grades.py',
    'correct explicit str conversion',
    lambda source: (
        source.replace('print(f"Score {score}: B")', 'print("Score " + str(score) + ": B")')
    ),
    expected='accept',
)

variant(
    'functions.py',
    'integer division for mean',
    lambda source: (
        source.replace('sum(numbers) / len(numbers)', 'sum(numbers) // len(numbers)')
    ),
    expected='reject',
)

variant(
    'functions.py',
    'strict greater-than threshold',
    lambda source: source.replace('score >= threshold', 'score > threshold'),
    expected='reject',
)

variant(
    'functions.py',
    'correct alternatives loop mean and conditional expression',
    lambda source: (
        source.replace(
            'return sum(numbers) / len(numbers)',
            (
                'total = 0\n'
                '    for n in numbers:\n'
                '        total += n\n'
                '    return total / len(numbers)'
            ),
        ).replace(
            (
                'if score >= threshold:\n'
                "        return 'pass'\n"
                '    else:\n'
                "        return 'fail'"
            ),
            "return 'pass' if score >= threshold else 'fail'",
        )
    ),
    expected='accept',
)

variant(
    'reference_lists.py',
    'deepcopies tracks only from late set',
    lambda source: (
        source.replace(
            'tracks = opening + late',
            (
                'import copy\n'
                '    tracks = opening + copy.deepcopy(late)'
            ),
        )
    ),
    expected='reject',
)

variant(
    'reference_lists.py',
    'correct list display and starred flatten',
    lambda source: (
        source.replace(
            (
                'sets = [opening, late]\n'
                '    sets.append(encore)\n'
                '    return sets'
            ),
            'return [opening, late, encore]',
        ).replace(
            (
                'tracks = opening + late\n'
                '    tracks.extend(encore)\n'
                '    return tracks'
            ),
            'return [*opening, *late, *encore]',
        )
    ),
    expected='accept',
)

variant(
    'member_playlists.py',
    'prepend tracks instead of append',
    lambda source: (
        source.replace('self.tracks.append(track)', 'self.tracks.insert(0, track)')
    ),
    expected='reject',
)

variant(
    'member_playlists.py',
    'correct append via slice assignment',
    lambda source: (
        source.replace(
            'self.tracks.append(track)',
            'self.tracks[len(self.tracks):] = [track]',
        )
    ),
    expected='accept',
)

variant(
    'member_playlists.py',
    'rename clears existing queue',
    lambda source: (
        source.replace(
            (
                '    def rename(self, new_name):\n'
                '        self.name = new_name\n'
                '\n'
                'artist'
            ),
            (
                '    def rename(self, new_name):\n'
                '        self.name = new_name\n'
                '        self.tracks = []\n'
                '\n'
                'artist'
            ),
        )
    ),
    expected='reject',
)

variant(
    'class_passes.py',
    'prepend notes instead of append',
    lambda source: source.replace('self.notes.append(note)', 'self.notes.insert(0, note)'),
    expected='reject',
)

variant(
    'class_passes.py',
    'correct counter with type(self)',
    lambda source: (
        source.replace('BackstagePass.created += 1', 'type(self).created += 1').replace(
            'self.serial = BackstagePass.created',
            'self.serial = type(self).created',
        )
    ),
    expected='accept',
)

variant(
    'copy_studio.py',
    'correct alternate shallow copy for lists',
    lambda source: (
        source.replace(
            'shallow = copy.copy(original)',
            'shallow = original.copy() if isinstance(original, list) else copy.copy(original)',
        )
    ),
    expected='accept',
)

variant(
    'copy_studio.py',
    'wrong deep copy is shallow copy',
    lambda source: (
        source.replace(
            'independent = copy.deepcopy(original)',
            'independent = copy.copy(original)',
        )
    ),
    expected='reject',
)

variant(
    'recording_equality.py',
    'compares field identity rather than value',
    lambda source: (
        source.replace(
            'self.title == other.title and self.artist == other.artist',
            'self.title is other.title and self.artist is other.artist',
        )
    ),
    expected='reject',
)

variant(
    'recording_equality.py',
    'duck-types unsupported objects',
    lambda source: (
        source.replace(
            'not isinstance(other, Recording)',
            "not (hasattr(other, 'title') and hasattr(other, 'artist'))",
        )
    ),
    expected='reject',
)

variant(
    'recording_equality.py',
    'correct tuple value comparison',
    lambda source: (
        source.replace(
            'self.title == other.title and self.artist == other.artist',
            '(self.title, self.artist) == (other.title, other.artist)',
        )
    ),
    expected='accept',
)

variant(
    'playlist_calls.py',
    'valid copy then append',
    lambda source: (
        source.replace(
            'return Playlist(playlist.tracks + [title])',
            (
                'tracks = playlist.tracks.copy()\n'
                '    tracks.append(title)\n'
                '    return Playlist(tracks)'
            ),
        )
    ),
    expected='accept',
)

variant(
    'playlist_calls.py',
    'valid explicit None branch',
    lambda source: (
        source.replace(
            (
                'if guests is None:\n'
                '        guests = []'
            ),
            (
                'if guests is None:\n'
                '        return [name]'
            ),
        )
    ),
    expected='accept',
)

variant(
    'playlist_calls.py',
    'wrong falsey default',
    lambda source: source.replace('if guests is None:', 'if not guests:'),
    expected='reject',
)

variant(
    'playlist_calls.py',
    'wrong preview sharing',
    lambda source: (
        source.replace(
            'return Playlist(playlist.tracks + [title])',
            (
                'playlist.tracks.append(title)\n'
                '    return Playlist(playlist.tracks)'
            ),
        )
    ),
    expected='reject',
)

variant(
    'festival_inheritance.py',
    'valid super proxy locals',
    lambda source: (
        source.replace(
            'super().__init__(title)',
            (
                'parent = super()\n'
                '        parent.__init__(title)'
            ),
        ).replace(
            'base_message = super().announce()',
            (
                'parent = super()\n'
                '        base_message = parent.announce()'
            ),
        )
    ),
    expected='accept',
)

variant(
    'festival_inheritance.py',
    'valid explicit super args',
    lambda source: (
        source.replace(
            'base_message = super().announce()',
            'base_message = super(StreamSet, self).announce()',
        )
    ),
    expected='accept',
)

variant(
    'festival_inheritance.py',
    'wrong separate base instance announce',
    lambda source: (
        source.replace(
            'base_message = super().announce()',
            'base_message = StageSet(self.title).announce()',
        )
    ),
    expected='reject',
)

variant(
    'typed_grades.py',
    'valid compact annotations',
    lambda source: (
        source.replace('numbers: list[float]', 'numbers:list[float]').replace(
            'score: int',
            'score:int',
        ).replace(
            'threshold: int',
            'threshold:int',
        ).replace(
            '-> float:',
            '->float:',
        ).replace(
            '-> str:',
            '->str:',
        )
    ),
    expected='accept',
)

variant(
    'typed_grades.py',
    'valid typing.List aliases',
    lambda source: (
        source.replace('from typing import Optional', 'from typing import Optional, List')
        .replace('list[float]', 'List[float]')
        .replace('list[int]', 'List[int]')
    ),
    expected='accept',
)

variant(
    'typed_grades.py',
    'valid PEP 604 optional type',
    lambda source: source.replace('Optional[int]', 'int | None'),
    expected='accept',
)

variant(
    'typed_grades.py',
    'valid deferred annotations',
    lambda source: 'from __future__ import annotations\n' + source,
    expected='accept',
)

variant(
    'typed_grades.py',
    'wrong threshold annotation',
    lambda source: source.replace('threshold: int', 'threshold: str'),
    expected='reject',
)

variant(
    'typed_grades.py',
    'wrong default threshold',
    lambda source: source.replace('threshold: int = 50', 'threshold: int = 60'),
    expected='reject',
)

variant(
    'typed_grades.py',
    'wrong smallest failing score instead of first',
    lambda source: source.replace('        return s\n', '        return min(scores)\n'),
    expected='reject',
)

variant(
    'typed_grades.py',
    'wrong mean element type',
    lambda source: source.replace('numbers: list[float]', 'numbers: list[str]'),
    expected='reject',
)

variant(
    'typed_grades.py',
    'wrong missing first_failing return hint',
    lambda source: source.replace(' -> Optional[int]:', ':'),
    expected='reject',
)

variant(
    'typed_grades.py',
    'valid whitespace before annotation colon',
    lambda source: source.replace('-> float:', '-> float :').replace('-> str:', '-> str :'),
    expected='accept',
)

variant(
    'loops.py',
    'valid indexed loop',
    lambda source: (
        replacefn(
            source,
            'running_total',
            (
                'def running_total(numbers: list[int]) -> list[int]:\n'
                '    out = []\n'
                '    for i in range(len(numbers)):\n'
                '        out.append(sum(numbers[:i+1]))\n'
                '    return out'
            ),
        )
    ),
    expected='accept',
)

variant(
    'loops.py',
    'valid pass retained as no-op',
    lambda source: source.replace('total += n', 'pass\n        total += n'),
    expected='accept',
)

variant(
    'loops.py',
    'wrong total resets each iteration',
    lambda source: source.replace('total += n', 'total = n'),
    expected='reject',
)

variant(
    'loops.py',
    'wrong mutate input',
    lambda source: (
        replacefn(
            source,
            'running_total',
            (
                'def running_total(numbers: list[int]) -> list[int]:\n'
                '    for i in range(1, len(numbers)):\n'
                '        numbers[i] += numbers[i-1]\n'
                '    return numbers'
            ),
        )
    ),
    expected='reject',
)

variant(
    'loops.py',
    'wrong fails empty',
    lambda source: (
        replacefn(
            source,
            'running_total',
            (
                'def running_total(numbers: list[int]) -> list[int]:\n'
                '    result = [numbers[0]]\n'
                '    for n in numbers[1:]:\n'
                '        result.append(result[-1]+n)\n'
                '    return result'
            ),
        )
    ),
    expected='reject',
    rejection_type="IndexError",
)

variant(
    'loops.py',
    'wrong no for',
    lambda source: (
        replacefn(
            source,
            'running_total',
            (
                'def running_total(numbers: list[int]) -> list[int]:\n'
                '    from itertools import accumulate\n'
                '    return list(accumulate(numbers))'
            ),
        )
    ),
    expected='reject',
)

variant(
    'listcomp.py',
    'valid explicit step square',
    lambda source: source.replace('range(1, n + 1)', 'range(1, n + 1, 1)'),
    expected='accept',
)

variant(
    'listcomp.py',
    'valid reordered comprehension',
    lambda source: (
        source.replace(
            'return [x for x in numbers if x > avg]',
            'return [item for item in numbers if avg < item]',
        )
    ),
    expected='accept',
)

variant(
    'listcomp.py',
    'wrong manual squares loop',
    lambda source: (
        replacefn(
            source,
            'squares_up_to',
            (
                'def squares_up_to(n: int) -> list[int]:\n'
                '    result = []\n'
                '    for x in range(1,n+1):\n'
                '        result.append(x**2)\n'
                '    return result'
            ),
        )
    ),
    expected='reject',
)

variant(
    'listcomp.py',
    'wrong hardcoded square bound',
    lambda source: source.replace('range(1, n + 1)', 'range(1, 6)'),
    expected='reject',
)

variant(
    'listcomp.py',
    'wrong excludes upper bound',
    lambda source: source.replace('range(1, n + 1)', 'range(1, n)'),
    expected='reject',
)

variant(
    'listcomp.py',
    'wrong includes zero',
    lambda source: source.replace('range(1, n + 1)', 'range(n + 1)'),
    expected='reject',
)

variant(
    'listcomp.py',
    'wrong no range',
    lambda source: source.replace('range(1, n + 1)', '[1, 2, 3, 4, 5]'),
    expected='reject',
)

variant(
    'listcomp.py',
    'wrong mean inclusive',
    lambda source: source.replace('if x > avg', 'if x >= avg'),
    expected='reject',
)

add(
    'word_count.py',
    'valid whole-file whitespace count',
    (
        'with open("data.txt") as f:\n'
        '    print("Total words:", len(f.read().split()))\n'
    ),
    expected='accept',
)

add(
    'word_count.py',
    'valid sum generator',
    (
        'with open("data.txt") as f:\n'
        '    total = sum(len(line.split()) for line in f)\n'
        'print("Total words:",total)\n'
    ),
    expected='accept',
)

add(
    'word_count.py',
    'wrong print each running subtotal',
    (
        'total=0\n'
        'with open("data.txt") as f:\n'
        '    for line in f:\n'
        '        total+=len(line.split())\n'
        '        print("Total words:",total)\n'
    ),
    expected='reject',
)

variant(
    'word_count.py',
    'wrong tenfold count',
    lambda source: (
        source.replace(
            'print(f"Total words: {total}")',
            'print(f"Total words: {total * 10}")',
        )
    ),
    expected='reject',
)

variant(
    'log_parser.py',
    'valid imported functions',
    lambda source: (
        source.replace('import re', 'from re import findall, sub').replace(
            're.findall',
            'findall',
        ).replace(
            're.sub',
            'sub',
        )
    ),
    expected='accept',
)

variant(
    'log_parser.py',
    'valid re alias',
    lambda source: (
        source.replace('import re', 'import re as regex').replace(
            're.findall',
            'regex.findall',
        ).replace(
            're.sub',
            'regex.sub',
        )
    ),
    expected='accept',
)

variant(
    'log_parser.py',
    'valid imported function aliases',
    lambda source: (
        source.replace('import re', 'from re import findall as matches, sub as replace')
        .replace('re.findall', 'matches')
        .replace('re.sub', 'replace')
    ),
    expected='accept',
)

variant(
    'log_parser.py',
    'wrong tenfold timestamp count',
    lambda source: source.replace('len(timestamps)', 'len(timestamps) * 10'),
    expected='reject',
)

variant(
    'log_parser.py',
    'wrong redact first address only',
    lambda source: source.replace("'x.x.x.x', text)", "'x.x.x.x', text, count=1)"),
    expected='reject',
)

variant(
    'log_parser.py',
    'wrong unescaped dots',
    lambda source: source.replace("r'\\d+\\.\\d+\\.\\d+\\.\\d+'", "r'\\d+.\\d+.\\d+.\\d+'"),
    expected='reject',
)

variant(
    'safe_word_count.py',
    'valid sum whole file',
    lambda source: (
        source.replace(
            (
                'total = 0\n'
                'with open(filename) as f:\n'
                '    for line in f:\n'
                '        total += len(line.split())'
            ),
            (
                'with open(filename) as f:\n'
                '    total = len(f.read().split())'
            ),
        )
    ),
    expected='accept',
)

variant(
    'safe_word_count.py',
    'valid stderr write',
    lambda source: (
        source.replace(
            'print(f"Reading: {filename}", file=sys.stderr)',
            'sys.stderr.write(f"Reading: {filename}\\n")',
        )
    ),
    expected='accept',
)

variant(
    'safe_word_count.py',
    'wrong ignores filename for read',
    lambda source: source.replace('open(filename)', 'open("data.txt")'),
    expected='reject',
)

variant(
    'safe_word_count.py',
    'wrong diagnostics also stdout',
    lambda source: (
        source.replace(
            'print(f"Reading: {filename}", file=sys.stderr)',
            (
                'print(f"Reading: {filename}", file=sys.stderr)\n'
                'print(f"Reading: {filename}")'
            ),
        )
    ),
    expected='reject',
)

variant(
    'safe_word_count.py',
    'wrong tenfold count',
    lambda source: (
        source.replace(
            'print(f"Total words: {total}")',
            'print(f"Total words: {total * 10}")',
        )
    ),
    expected='reject',
)

add(
    'log_analyzer.py',
    'valid no helper layout',
    (
        'import sys, re\n'
        'if len(sys.argv)<2:\n'
        "    print('Missing filename',file=sys.stderr)\n"
        '    sys.exit(1)\n'
        'filename=sys.argv[1]\n'
        "print(f'Reading: {filename}',file=sys.stderr)\n"
        'with open(filename) as f:\n'
        '    text=f.read()\n'
        "print('Log Analysis Report')\n"
        "print('===================')\n"
        "print(f'Total lines:    {len(text.splitlines())}')\n"
        'print(f\'Unique IPs:     {len(set(re.findall(r"[0-9]+[.][0-9]+[.][0-9]+[.][0-9]+",text)))}\')\n'
        'print(f\'Errors:         {len(re.findall("ERROR.*",text))}\')\n'
        'print(f\'Warnings:       {len(re.findall("WARNING.*",text))}\')\n'
    ),
    expected='accept',
)

variant(
    'log_analyzer.py',
    'valid line splitting with endings preserved',
    lambda source: (
        source.replace(
            'lines = text.splitlines()',
            'lines = text.splitlines(keepends=True)',
        )
    ),
    expected='accept',
)

variant(
    'log_analyzer.py',
    'valid set comprehension',
    lambda source: replacefn(
        source, 'extract_ips',
        'def extract_ips(text: str) -> set[str]:\n'
        r"    return {ip for ip in re.findall(r'\d+\.\d+\.\d+\.\d+', text)}",
    ),
    expected='accept',
)

variant(
    'log_analyzer.py',
    'valid regex import alias',
    lambda source: (
        source.replace('import re', 'import re as regex')
        .replace('re.findall', 'regex.findall')
    ),
    expected='accept',
)

variant(
    'log_analyzer.py',
    'wrong no deduplication',
    lambda source: (
        source.replace(
            "return set(re.findall(r'\\d+\\.\\d+\\.\\d+\\.\\d+', text))",
            "return re.findall(r'\\d+\\.\\d+\\.\\d+\\.\\d+', text)",
        )
    ),
    expected='reject',
)

variant(
    'log_analyzer.py',
    'wrong counts tenfold',
    lambda source: (
        source.replace('{total}', '{total*10}').replace('{unique_ips}', '{unique_ips*10}').replace(
            '{errors}',
            '{errors*10}',
        ).replace(
            '{warnings}',
            '{warnings*10}',
        )
    ),
    expected='reject',
)

variant(
    'log_analyzer.py',
    'wrong ignore filename',
    lambda source: source.replace('open(filename)', 'open("server.log")'),
    expected='reject',
)

variant(
    'log_analyzer.py',
    'wrong header absent',
    lambda source: (
        source.replace('    print("Log Analysis Report")', '').replace(
            '    print("===================")',
            '',
        )
    ),
    expected='reject',
)

variant(
    'geometry.py',
    'valid hypot',
    lambda source: (
        source.replace(
            'return (self.x ** 2 + self.y ** 2) ** 0.5',
            (
                'import math\n'
                '        return math.hypot(self.x,self.y)'
            ),
        )
    ),
    expected='accept',
)

variant(
    'geometry.py',
    'valid qualified dataclass',
    lambda source: (
        source.replace('from dataclasses import dataclass', 'import dataclasses').replace(
            '@dataclass(',
            '@dataclasses.dataclass(',
        )
    ),
    expected='accept',
)

variant(
    'geometry.py',
    'valid imported dataclass alias',
    lambda source: (
        source.replace('from dataclasses import dataclass',
                       'from dataclasses import dataclass as record')
        .replace('@dataclass', '@record')
    ),
    expected='accept',
)

variant(
    'geometry.py',
    'wrong RGB field type',
    lambda source: source.replace('    r: int', '    r: str'),
    expected='reject',
)

variant(
    'geometry.py',
    'wrong distance annotation',
    lambda source: source.replace('distance_to_origin(self) -> float',
                                  'distance_to_origin(self) -> int'),
    expected='reject',
)

variant(
    'geometry.py',
    'wrong RGB conversion method instead of property',
    lambda source: source.replace('    @property\n    def as_hex', '    def as_hex'),
    expected='reject',
)

variant(
    'geometry.py',
    'wrong distance constant',
    lambda source: source.replace('return (self.x ** 2 + self.y ** 2) ** 0.5', 'return 5.0'),
    expected='reject',
)

variant(
    'geometry.py',
    'wrong distance x only',
    lambda source: (
        source.replace(
            'return (self.x ** 2 + self.y ** 2) ** 0.5',
            'return float(self.x + 2)',
        )
    ),
    expected='reject',
)

variant(
    'geometry.py',
    'wrong Point field annotations',
    lambda source: (
        source.replace('    x: int', '    x: str').replace('    y: int', '    y: str')
    ),
    expected='reject',
)

variant(
    'geometry.py',
    'wrong rounded distance',
    lambda source: (
        source.replace(
            'return (self.x ** 2 + self.y ** 2) ** 0.5',
            'return round((self.x ** 2 + self.y ** 2) ** 0.5, 0)',
        )
    ),
    expected='reject',
)

variant(
    'log_analyzer.py',
    'wrong discards boundary blank lines',
    lambda source: (
        source.replace('lines = text.splitlines()', 'lines = text.strip().splitlines()')
    ),
    expected='reject',
)
