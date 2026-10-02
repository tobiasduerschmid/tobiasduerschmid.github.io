"""Bounded, JSON-friendly analysis using Python's real ``re`` engine.

Spans are Python Unicode code-point offsets; end offsets are exclusive.
Candidate probes illustrate calls to match at successive positions, never an
internal backtracking trace. The worker host owns cancellation and time limits.
"""

from contextlib import redirect_stdout
import io
import json
import platform
import re


INPUT_LIMITS = {"pattern": 2000, "text": 20000, "replacement": 2000}
MATCH_LIMIT = 200
PROBE_LIMIT = 100
OUTPUT_LIMIT = 100000
RESULT_TEXT_LIMIT = 100000
CAPTURE_RECORD_LIMIT = 5000
FLAGS = {name: getattr(re, name) for name in
         ("IGNORECASE", "MULTILINE", "DOTALL", "VERBOSE", "ASCII")}
OPERATIONS = {"finditer", "search", "match", "fullmatch", "sub"}


class _InputError(ValueError):
    def __init__(self, message, field):
        super().__init__(message)
        self.field = field


def analyze_regex(request: dict) -> dict:
    """Return matches, captures, explanations, compiler output, and start probes.

    ``request`` accepts pattern, text, a list of flag names, operation, and
    replacement. Missing strings default to empty; operation defaults to
    finditer. Expected input/regex errors return ``ok: false`` with field and
    Python error coordinates (when available). Substitution is complete even
    when the displayed match list is truncated; oversized output is an error.
    """
    field = "pattern"
    try:
        values, flags, operation = _validate_request(request)
        compiled, debug = _compile_with_debug(values["pattern"], flags)
        matches, truncated = _collect_matches(compiled, values["text"], operation)
        output = None
        if operation == "sub":
            field = "replacement"
            output = _substitute(compiled, values)
        field = "pattern"
        probes, probes_truncated = _candidate_probes(compiled, values["text"], operation)
        explanation = _PythonParser.explain(values["pattern"], flags, compiled)
        return {"ok": True, "version": platform.python_version(), "matches": matches,
                "truncated": truncated, "output": output, "explanation": explanation,
                "debug": debug, "probes": probes, "probesTruncated": probes_truncated}
    except _InputError as error:
        return _error_result(error, error.field)
    except (re.error, IndexError, ValueError, OverflowError, RecursionError) as error:
        return _error_result(error, field)


def analyze_regex_json(request_json: str) -> str:
    """Dispatch analyze (default) or test requests; JSON is never executed as code."""
    try:
        request = json.loads(request_json)
    except (json.JSONDecodeError, TypeError) as error:
        return json.dumps(_error_result(error, "pattern"))
    action = request.get("action", "analyze") if isinstance(request, dict) else "analyze"
    if action == "test":
        result = test_regex(request)
    elif action == "analyze":
        result = analyze_regex(request)
    else:
        result = _error_result(_InputError("Choose analyze or test.", "pattern"), "pattern")
    return json.dumps(result, ensure_ascii=True)


def test_regex(request: dict) -> dict:
    """Compare 1–50 user-authored positive/negative cases using real Python re.

    Cases have unique nonempty string ids, text, and a Boolean expected value.
    Their combined text is limited to 20,000 code points. Fullmatch is the
    default; search is the only other suite operation. No compiler trace or
    capture payload is generated when checking cases.
    """
    try:
        values, flags, operation = _validate_request(request)
        operation = request.get("operation", "fullmatch")
        if operation not in {"search", "fullmatch"}:
            raise _InputError("Test cases support fullmatch or search.", "pattern")
        cases = _validate_cases(request.get("cases"))
        match_case = getattr(re.compile(values["pattern"], flags), operation)
        results = []
        for case in cases:
            matched = match_case(case["text"]) is not None
            results.append({"id": case["id"], "matched": matched,
                            "passed": matched == case["expected"]})
        return {"ok": True, "cases": results,
                "passed": sum(result["passed"] for result in results),
                "total": len(results), "version": platform.python_version()}
    except _InputError as error:
        return _error_result(error, error.field)
    except (re.error, ValueError, OverflowError, RecursionError) as error:
        return _error_result(error, "pattern")


def _validate_cases(cases):
    if not isinstance(cases, list) or not 1 <= len(cases) <= 50:
        raise _InputError("Add between 1 and 50 test cases.", "text")
    seen_ids, text_length = set(), 0
    for case in cases:
        if not isinstance(case, dict):
            raise _InputError("Each test case must have an id, text, and an expected result.", "text")
        case_id = case.get("id")
        if not isinstance(case_id, str) or not 1 <= len(case_id) <= 100 or case_id in seen_ids:
            raise _InputError("Test case ids must be unique strings of 1–100 characters.", "text")
        if not isinstance(case.get("text"), str) or not isinstance(case.get("expected"), bool):
            raise _InputError("Each test case needs text and a Boolean expected result.", "text")
        seen_ids.add(case_id)
        text_length += len(case["text"])
        if text_length > INPUT_LIMITS["text"]:
            raise _InputError("Test cases are limited to 20,000 total text characters.", "text")
    return cases


def _error_result(error, field):
    return {"ok": False, "error": {"message": str(error), "field": field,
            "position": getattr(error, "pos", None), "line": getattr(error, "lineno", None),
            "column": getattr(error, "colno", None)}}


def _validate_request(request):
    if not isinstance(request, dict):
        raise _InputError("The analysis request must be an object.", "pattern")
    values = {}
    for field, limit in INPUT_LIMITS.items():
        value = request.get(field, "")
        if not isinstance(value, str):
            raise _InputError(f"{field.capitalize()} must be text.", field)
        if len(value) > limit:
            raise _InputError(f"{field.capitalize()} is limited to {limit:,} characters.", field)
        values[field] = value
    operation = request.get("operation", "finditer")
    if not isinstance(operation, str) or operation not in OPERATIONS:
        raise _InputError("Choose finditer, search, match, fullmatch, or sub.", "pattern")
    return values, _parse_flags(request.get("flags", [])), operation


def _parse_flags(names):
    if not isinstance(names, list):
        raise _InputError("Flags must be a list of Python flag names.", "pattern")
    flags = 0
    for name in names:
        if not isinstance(name, str) or name not in FLAGS:
            raise _InputError(f"Unsupported Python flag: {name!r}.", "pattern")
        flags |= FLAGS[name]
    return flags


def _compile_with_debug(pattern, flags):
    debug = io.StringIO()
    with redirect_stdout(debug):
        compiled = re.compile(pattern, flags | re.DEBUG)
    return compiled, debug.getvalue()


def _collect_matches(compiled, text, operation):
    budget = _MatchBudget()
    if operation in {"search", "match", "fullmatch"}:
        match = getattr(compiled, operation)(text)
        return ([_serialize_match(match, budget)] if match is not None else []), False
    matches = []
    for match in compiled.finditer(text):
        if len(matches) == MATCH_LIMIT:
            return matches, True
        matches.append(_serialize_match(match, budget))
    return matches, False


class _MatchBudget:
    """Bound duplicated capture data before allocating result strings or records."""

    def __init__(self):
        self.text_length = 0
        self.capture_count = 0

    def reserve(self, match):
        self.capture_count += match.re.groups
        if self.capture_count > CAPTURE_RECORD_LIMIT:
            raise _InputError("Results exceed 5,000 capture records. "
                              "Use shorter text or fewer capture groups.", "text")
        self.text_length += sum(max(0, match.end(number) - match.start(number))
                                for number in range(match.re.groups + 1))
        if self.text_length > RESULT_TEXT_LIMIT:
            raise _InputError("Results exceed 100,000 displayed match and capture characters. "
                              "Use shorter text or fewer capture groups.", "text")


def _serialize_match(match, budget):
    budget.reserve(match)
    names = {number: name for name, number in match.re.groupindex.items()}
    groups = [{"number": number, "name": names.get(number), "start": match.start(number),
               "end": match.end(number), "text": match.group(number)}
              for number in range(1, match.re.groups + 1)]
    return {"start": match.start(), "end": match.end(), "text": match.group(), "groups": groups}


def _candidate_probes(compiled, text, operation):
    anchored = operation in {"match", "fullmatch"}
    positions = 1 if anchored else len(text) + 1
    match_at = compiled.fullmatch if operation == "fullmatch" else compiled.match
    probes = []
    for position in range(min(positions, PROBE_LIMIT)):
        match = match_at(text, position)
        probes.append({"position": position, "matched": match is not None,
                       "start": match.start() if match is not None else None,
                       "end": match.end() if match is not None else None,
                       "text": match.group() if match is not None else None})
        if match is not None:
            return probes, False
    return probes, positions > PROBE_LIMIT


def _substitute(compiled, values):
    replacement, text = values["replacement"], values["text"]
    template = _PythonParser.replacement_parts(replacement, compiled)
    pieces, cursor, length = [], 0, 0
    # Python finditer preserves sub's empty-match ordering. Check expansion size
    # before match.expand: a short template can repeat a very large capture.
    for match in compiled.finditer(text):
        length += match.start() - cursor + _expanded_length(template, match)
        _check_output_length(length)
        pieces.extend((text[cursor:match.start()], match.expand(replacement)))
        cursor = match.end()
    _check_output_length(length + len(text) - cursor)
    pieces.append(text[cursor:])
    return "".join(pieces)


def _expanded_length(template, match):
    return sum(max(0, match.end(part) - match.start(part)) if isinstance(part, int)
               else len(part) for part in template)


def _check_output_length(length):
    if length > OUTPUT_LIMIT:
        raise _InputError(f"Replacement output exceeds {OUTPUT_LIMIT:,} characters. "
                          "Use shorter text or a shorter replacement.", "replacement")


class _PythonParser:
    """Isolate the private CPython parser used by pinned Pyodide 0.27 / Python 3.12.

    Matching and expansion always use public re APIs. The private tree supplies
    explanations; its replacement tokens permit size checks before allocation.
    Python 3.12 and 3.13 share these structures. Audit this adapter on upgrades.
    """

    @staticmethod
    def replacement_parts(replacement, compiled):
        from re import _parser
        return _parser.parse_template(replacement, compiled)

    @staticmethod
    def explain(pattern, flags, compiled):
        from re import _parser
        tree = _parser.parse(pattern, flags)
        names = {number: name for name, number in compiled.groupindex.items()}
        rows = [{"depth": 0, "label": "Python pattern structure",
                 "detail": "Python's parsed structure may combine or simplify syntax. "
                           "This is not a backtracking trace."}]
        rows.extend(_explain_nodes(tree, tree.state.flags, names, 0))
        if not tree:
            rows.append({"depth": 0, "label": "Empty pattern", "detail": "Matches an empty string."})
        return rows


def _row(depth, label, detail):
    return {"depth": depth, "label": label, "detail": detail}


def _explain_nodes(nodes, flags, names, depth):
    for opcode, value in nodes:
        operation = str(opcode)
        if operation in _NESTED_EXPLAINERS:
            yield from _NESTED_EXPLAINERS[operation](value, flags, names, depth)
        else:
            yield _explain_leaf(operation, value, flags, names, depth)


def _explain_leaf(operation, value, flags, names, depth):
    case_note = " Case-insensitive matching is active." if flags & re.IGNORECASE else ""
    details = {
        "LITERAL": lambda: ("Literal", f"Match {chr(value)!r}." + case_note),
        "NOT_LITERAL": lambda: ("Excluded literal", f"Match one character other than {chr(value)!r}." + case_note),
        "ANY": lambda: ("Any character", "Match any character" + ("." if flags & re.DOTALL else " except a newline.")),
        "RANGE": lambda: ("Character range", f"From {chr(value[0])!r} through {chr(value[1])!r}, inclusive." + case_note),
        "NEGATE": lambda: ("Negated set", "Match a character outside the following set."),
        "CATEGORY": lambda: ("Character category", _category_detail(str(value), flags)),
        "AT": lambda: ("Position assertion", _anchor_detail(str(value), flags)),
        "GROUPREF": lambda: ("Backreference", f"Match the text captured by {_group_name(value, names)}." + case_note),
    }
    if operation in details:
        label, detail = details[operation]()
        return _row(depth, label, detail)
    return _row(depth, f"Python opcode {operation}",
                f"Python parser operand: {value!r}. Consult the compiler output for this construct.")


def _group_name(number, names):
    return f"group {number}" + (f" ({names[number]!r})" if number in names else "")


def _category_detail(category, flags):
    alphabet = "ASCII" if flags & re.ASCII else "Unicode"
    categories = {"CATEGORY_DIGIT": f"One {alphabet} decimal digit.",
                  "CATEGORY_NOT_DIGIT": f"One character outside the {alphabet} decimal-digit category.",
                  "CATEGORY_SPACE": f"One {alphabet} whitespace character.",
                  "CATEGORY_NOT_SPACE": f"One character outside the {alphabet} whitespace category.",
                  "CATEGORY_WORD": f"One {alphabet} word character (alphanumeric or underscore).",
                  "CATEGORY_NOT_WORD": f"One character outside the {alphabet} word-character category."}
    return categories.get(category, f"Python category {category}.")


def _anchor_detail(anchor, flags):
    multiline = bool(flags & re.MULTILINE)
    anchors = {"AT_BEGINNING": "Start of the string" + (" or a line." if multiline else "."),
               "AT_BEGINNING_STRING": "Start of the string.",
               "AT_END": "End of the string or before its final newline" +
                         (", or before a newline within the string." if multiline else "."),
               "AT_END_STRING": "End of the string.",
               "AT_BOUNDARY": "A word boundary, using the active Unicode or ASCII word-character rules.",
               "AT_NON_BOUNDARY": "A non-word-boundary position under this Python version's rules."}
    return anchors.get(anchor, f"Python position assertion {anchor}.")


def _explain_set(value, flags, names, depth):
    yield _row(depth, "Character set", "Match one character using these members.")
    yield from _explain_nodes(value, flags, names, depth + 1)


def _explain_group(value, flags, names, depth):
    number, added_flags, removed_flags, children = value
    label = "Capture " + _group_name(number, names) if number else "Scoped group"
    detail = "Capture the text matched inside." if number else "Group the enclosed pattern."
    if added_flags or removed_flags:
        detail += f" Scoped flags: add {re.RegexFlag(added_flags)!s}; remove {re.RegexFlag(removed_flags)!s}."
    yield _row(depth, label, detail)
    type_flags = re.ASCII | re.LOCALE | re.UNICODE
    if added_flags & type_flags:
        flags &= ~type_flags
    yield from _explain_nodes(children, (flags | added_flags) & ~removed_flags, names, depth + 1)


def _explain_branch(value, flags, names, depth):
    yield _row(depth, "Alternatives", "Try alternatives from left to right.")
    for index, children in enumerate(value[1], 1):
        yield _row(depth + 1, f"Alternative {index}", "Empty alternative." if not children else "")
        yield from _explain_nodes(children, flags, names, depth + 2)


def _explain_repeat(value, flags, names, depth, mode):
    minimum, maximum, children = value
    upper = "unbounded" if str(maximum) == "MAXREPEAT" else str(maximum)
    preferences = {"greedy": "Prefer more repetitions, then give some back if needed.",
                   "lazy": "Prefer fewer repetitions, then try more if needed.",
                   "possessive": "Prefer more repetitions without giving them back."}
    yield _row(depth, f"Repeat ({mode})", f"From {minimum} to {upper} repetitions. {preferences[mode]}")
    yield from _explain_nodes(children, flags, names, depth + 1)


def _explain_assertion(value, flags, names, depth, positive):
    direction, children = value
    label = ("Positive " if positive else "Negative ") + ("lookbehind" if direction < 0 else "lookahead")
    yield _row(depth, label, "Require the enclosed pattern " +
               ("to match" if positive else "not to match") + " without consuming characters.")
    yield from _explain_nodes(children, flags, names, depth + 1)


def _explain_conditional(value, flags, names, depth):
    number, yes_branch, no_branch = value
    yield _row(depth, "Conditional group", f"Choose a branch depending on whether {_group_name(number, names)} participated.")
    yield _row(depth + 1, "If the group participated", "")
    yield from _explain_nodes(yes_branch, flags, names, depth + 2)
    if no_branch is not None:
        yield _row(depth + 1, "Otherwise", "")
        yield from _explain_nodes(no_branch, flags, names, depth + 2)


def _explain_atomic(value, flags, names, depth):
    yield _row(depth, "Atomic group", "After leaving this group, do not backtrack into it.")
    yield from _explain_nodes(value, flags, names, depth + 1)


_NESTED_EXPLAINERS = {
    "IN": _explain_set, "SUBPATTERN": _explain_group, "BRANCH": _explain_branch,
    "GROUPREF_EXISTS": _explain_conditional, "ATOMIC_GROUP": _explain_atomic,
    "MAX_REPEAT": lambda *args: _explain_repeat(*args, "greedy"),
    "MIN_REPEAT": lambda *args: _explain_repeat(*args, "lazy"),
    "POSSESSIVE_REPEAT": lambda *args: _explain_repeat(*args, "possessive"),
    "ASSERT": lambda *args: _explain_assertion(*args, True),
    "ASSERT_NOT": lambda *args: _explain_assertion(*args, False),
}
