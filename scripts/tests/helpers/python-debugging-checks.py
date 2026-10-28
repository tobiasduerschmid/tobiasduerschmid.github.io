"""Exercise the debugging lesson's authored checks on native Python.

Candidates remain independent of the editable pytest files and sample data.
The browser smoke test separately establishes execution in the real backend.
"""
import contextlib
import importlib
import io
import json
from pathlib import Path
import sys
import tempfile
import textwrap


def source(text):
    return textwrap.dedent(text).lstrip()


def production(step, solution=False):
    files = step['solution']['files'] if solution else step['files']
    return next(file['content'] for file in files if file['path'] == step['open_file'])


def replace_function(program, name, replacement):
    """Replace a candidate function without depending on its current line numbers."""
    import ast
    tree = ast.parse(program)
    definition = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == name)
    lines = program.splitlines(keepends=True)
    return ''.join(lines[:definition.lineno - 1]) + source(replacement) + '\n' + ''.join(lines[definition.end_lineno:])


def evaluate(step, candidate, tamper=False):
    failures = []
    with tempfile.TemporaryDirectory(prefix='python-debugging-grader-') as directory:
        workspace = Path(directory)
        previous_path = sys.path[:]
        sys.path.insert(0, directory)
        try:
            for file in step['files']:
                content = file['content']
                if tamper and file['path'].startswith('test_'):
                    content = 'def test_weakened():\n    assert True\n'
                elif tamper and file['path'].endswith(('.csv', '.txt')):
                    content = ''
                (workspace / file['path']).write_text(content.replace('/tutorial', directory))
            (workspace / step['open_file']).write_text(candidate)
            for check in step['tests']:
                try:
                    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                        exec(check['command'].replace('/tutorial', directory), {'__name__': '__main__'})
                except Exception as error:
                    failures.append({'check': check['description'], 'type': type(error).__name__, 'message': str(error)})
        finally:
            sys.path[:] = previous_path
            for name, module in list(sys.modules.items()):
                if directory in (getattr(module, '__file__', '') or ''):
                    del sys.modules[name]
            importlib.invalidate_caches()
    return failures


def alternatives(filename, starter, model):
    if filename == 'greet.py':
        return [
            ('direct sequence join', source('''
                def greet(names):
                    return ', '.join(['Hello', *names]) + '!'
            ''')),
            ('name iteration', source('''
                def greet(names):
                    result = 'Hello'
                    for name in names:
                        result += ', ' + name
                    return result + '!'
            ''')),
        ]
    if filename == 'pathfinder.py':
        return [
            ('cutoff before goal with a strict upper bound', starter.replace('steps_used >= max_steps', 'steps_used > max_steps')),
            ('breadth-first search', source('''
                from collections import deque
                def find_path(maze, max_steps):
                    positions = {cell: (r, c) for r, row in enumerate(maze) for c, cell in enumerate(row) if cell in 'SG'}
                    pending = deque([[positions['S']]])
                    seen = {positions['S']}
                    while pending:
                        path = pending.popleft()
                        r, c = path[-1]
                        if (r, c) == positions['G']:
                            return path
                        if len(path) - 1 >= max_steps:
                            continue
                        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                            position = r + dr, c + dc
                            nr, nc = position
                            if 0 <= nr < len(maze) and 0 <= nc < len(maze[nr]) and maze[nr][nc] != '#' and position not in seen:
                                seen.add(position)
                                pending.append(path + [position])
                    return None
            ''')),
        ]
    if filename == 'ledger.py':
        return [
            ('normalize after converting case', model.replace('row["type"].strip().upper()', 'row["type"].upper().lstrip().rstrip()')),
            ('normalization helper', 'def canonical_kind(value):\n    return value.strip().upper()\n\n' + model.replace('row["type"].strip().upper()', 'canonical_kind(row["type"])')),
        ]
    if filename == 'waitlist.py':
        return [
            ('slicing preserves queue order', model.replace('next_student = course.waitlist.pop(0)', 'next_student = course.waitlist[0]\n        del course.waitlist[:1]')),
            ('deque queue', 'from collections import deque\n' + model.replace('waitlist: list[str] = field(default_factory=list)', 'waitlist: deque[str] = field(default_factory=deque)').replace('course.waitlist.pop(0)', 'course.waitlist.popleft()')),
        ]
    if filename == 'tagger.py':
        return [
            ('split lines before counting', source('''
                from collections import Counter
                def top_tag(articles_path):
                    with open(articles_path) as data:
                        tags = [line.split('|', 1)[1].upper().strip() for line in data.read().splitlines()]
                    return Counter(tags).most_common(1)[0][0]
            ''')),
            ('explicit frequency map', source('''
                def top_tag(articles_path):
                    counts = {}
                    with open(articles_path) as data:
                        for line in data:
                            name = line.partition('|')[2].strip().upper()
                            counts[name] = counts.get(name, 0) + 1
                    return max(counts, key=counts.get)
            ''')),
        ]
    raise AssertionError(f'Missing alternative submissions for {filename}')


def mistakes(filename, starter, model):
    if filename == 'greet.py':
        return [
            ('hardcoded sample greeting', "def greet(names):\n    return 'Hello, Ada, Linus, Grace!'\n", 'reject'),
            ('correct greeting but input list consumed', source('''
                def greet(names):
                    result = ', '.join(['Hello', *names]) + '!'
                    names.clear()
                    return result
            '''), 'partial'),
            ('only singleton and empty cases repaired', source('''
                def greet(names):
                    if len(names) == 1:
                        return 'Hello, ' + names[0] + '!'
                    return 'Hello!'
            '''), 'partial'),
        ]
    if filename == 'pathfinder.py':
        return [
            ('budget ignored', starter.replace('if steps_used >= max_steps:', 'if False:'), 'reject'),
            ('fabricated disconnected route', "def find_path(maze, max_steps):\n    return [(1, 1), (1, 3)]\n", 'reject'),
            ('every route rejected', "def find_path(maze, max_steps):\n    return None\n", 'partial'),
        ]
    if filename == 'ledger.py':
        return [
            ('normalization only in the consumer', starter.replace('before = balances.get(tx.account, 0)', 'tx = Transaction(tx.id, tx.account, tx.kind.strip(), tx.amount_cents)\n    before = balances.get(tx.account, 0)'), 'partial'),
            ('leading whitespace only', model.replace('.strip().upper()', '.lstrip().upper()'), 'partial'),
            ('reversal arithmetic changed', model.replace('elif tx.kind == "REVERSAL":\n        after = before + tx.amount_cents', 'elif tx.kind == "REVERSAL":\n        after = before - tx.amount_cents'), 'partial'),
            ('all kinds treated as deposits', model.replace('row["type"].strip().upper()', '"DEPOSIT"'), 'partial'),
        ]
    if filename == 'waitlist.py':
        return [
            ('alphabetical admission', model.replace('next_student = course.waitlist.pop(0)', 'course.waitlist.sort()\n        next_student = course.waitlist.pop(0)'), 'reject'),
            ('only one opening filled', model.replace('while course.open_seats > 0 and course.waitlist:', 'if course.open_seats > 0 and course.waitlist:'), 'partial'),
            ('arrival order reversed to compensate for last removal', starter.replace('course.waitlist.append(student)', 'course.waitlist.insert(0, student)'), 'partial'),
            ('remaining queue discarded', model.replace('course.enrolled.append(next_student)', 'course.enrolled.append(next_student)\n        course.waitlist.clear()'), 'reject'),
        ]
    if filename == 'tagger.py':
        return [
            ('only returned tag cleaned', starter.replace('return counts.most_common(1)[0][0]', 'return counts.most_common(1)[0][0].strip()'), 'partial'),
            ('hardcoded winning tag', "def top_tag(articles_path):\n    return 'PYTHON'\n", 'partial'),
            ('internal whitespace deleted', model.replace('tag.strip().upper()', "''.join(tag.split()).upper()"), 'partial'),
        ]
    raise AssertionError(f'Missing incorrect submissions for {filename}')


def main():
    config = json.load(sys.stdin)
    results = []
    for step in config['steps']:
        if not step.get('tests'):
            continue
        filename = step['open_file']
        starter, model = production(step), production(step, solution=True)
        cases = [('published solution', model, 'accept', False), ('starter', starter, 'reject', False)]
        cases += [(name, program, 'accept', False) for name, program in alternatives(filename, starter, model)]
        cases += [(name, program, expected, False) for name, program, expected in mistakes(filename, starter, model)]
        cases += [('weakened editable tests and changed sample data', starter, 'reject', True)]
        for name, program, expected, tamper in cases:
            compile(program, filename, 'exec')
            failures = evaluate(step, program, tamper)
            results.append({'name': f'{filename}: {name}', 'expected': expected,
                            'failures': failures, 'passed': len(step['tests']) - len(failures)})
    print(json.dumps(results))


if __name__ == '__main__':
    main()
