"""Bounded Python object graphs for the Object Reference Lab.

The public trace_code(source) function returns JSON and works in CPython and
Pyodide. A dedicated browser worker owns execution timeout and cancellation.
Inspection uses only builtin storage access: it never evaluates a learner's
repr, properties, equality, or hashing merely to draw an object.
"""

import ast
import builtins
import io
import json
import sys
import types
from contextlib import redirect_stderr, redirect_stdout
from inspect import CO_NEWLOCALS


SOURCE_FILENAME = "<object-reference-lab>"
MAX_SOURCE_LENGTH = 20000
MAX_STEPS = 400
MAX_LINE_EVENTS = 300
MAX_NODES = 80
MAX_ENTRIES = 24
MAX_DEPTH = 6
MAX_SCOPES = 12
MAX_OUTPUT_LENGTH = 8000
MAX_VALUE_LENGTH = 160

_TYPE_DICTIONARY = type.__dict__["__dict__"]
_TYPE_NAME = type.__dict__["__name__"]
_TYPE_MRO = type.__dict__["__mro__"]
_TYPE_BASES = type.__dict__["__bases__"]
_TYPE_MODULE = type.__dict__["__module__"]
_EXCEPTION_ARGS = BaseException.__dict__["args"]
_EXCEPTION_TRACEBACK = BaseException.__dict__["__traceback__"]
_HIDDEN_NAMES = frozenset(("__builtins__", "__name__", "__package__", "__loader__",
                           "__spec__", "__module__", "__qualname__", "__classcell__"))
_HIDDEN_CLASS_NAMES = _HIDDEN_NAMES | frozenset(("__firstlineno__", "__static_attributes__"))
_HIDDEN_ATTRIBUTES = _HIDDEN_CLASS_NAMES | frozenset(("__dict__", "__weakref__", "__doc__"))
_PRIMITIVE_FORMATTERS = ((str, str.__repr__), (bytes, bytes.__repr__), (int, int.__repr__),
                         (float, float.__repr__), (complex, complex.__repr__), (bool, bool.__repr__))


def _class_name(cls):
    return _TYPE_NAME.__get__(cls)


def _class_dictionary(cls):
    return _TYPE_DICTIONARY.__get__(cls)


def _class_mro(cls):
    return _TYPE_MRO.__get__(cls)


def _is_class(value):
    return any(base is type for base in _class_mro(type(value)))


def _clip(text):
    return text if len(text) <= MAX_VALUE_LENGTH else text[:MAX_VALUE_LENGTH] + "…"


def _primitive_value(value):
    """Return literal text for exact builtin primitives, or None for other objects."""
    value_type = type(value)
    if value is None:
        return "None"
    # A dict keyed by classes could execute a learner's metaclass __hash__.
    formatter = next((format_value for cls, format_value in _PRIMITIVE_FORMATTERS
                      if value_type is cls), None)
    if formatter is None:
        return None
    if value_type is str or value_type is bytes:
        suffix = "…" if len(value) > MAX_VALUE_LENGTH else ""
        return _clip(formatter(value[:MAX_VALUE_LENGTH])) + suffix
    if value_type is int and int.bit_length(value) > 2048:
        return "<integer: " + str(int.bit_length(value)) + " bits>"
    return _clip(formatter(value))


def _instance_dictionary(value):
    # Calling object.__getattribute__(value, '__dict__') could invoke a property.
    # Only the native storage descriptor is safe to evaluate for inspection.
    for base in _class_mro(type(value)):
        descriptor = _class_dictionary(base).get("__dict__")
        if type(descriptor) is types.GetSetDescriptorType:
            storage = descriptor.__get__(value, type(value))
            return storage if type(storage) is dict else None
    return None


def _error_text(error):
    """Format failures without running a user-defined exception __str__."""
    parts = []
    for argument in _EXCEPTION_ARGS.__get__(error)[:3]:
        literal = _primitive_value(argument)
        parts.append(argument if type(argument) is str else literal or "<object argument>")
    detail = ": " + _clip("; ".join(parts)) if parts else ""
    return _class_name(type(error)) + detail


def _is_class_body(frame):
    return frame.f_code.co_name != "<module>" and not frame.f_code.co_flags & CO_NEWLOCALS


def _literal_definition_value(node):
    """Recognize inert literals, without guessing whether user expressions are pure."""
    if node is None or isinstance(node, ast.Constant):
        return True
    if isinstance(node, (ast.List, ast.Tuple, ast.Set)):
        return all(_literal_definition_value(child) for child in node.elts)
    if isinstance(node, ast.Dict):
        return all(key is not None and _literal_definition_value(key) for key in node.keys) and all(
            _literal_definition_value(value) for value in node.values)
    return False


def _passive_definition(node):
    if node.decorator_list or getattr(node, "type_params", ()):
        return False
    if isinstance(node, ast.ClassDef):
        # Bases can invoke __mro_entries__, __init_subclass__, or a metaclass.
        return not node.bases and not node.keywords
    arguments = node.args
    parameters = arguments.posonlyargs + arguments.args + arguments.kwonlyargs
    parameters += [argument for argument in (arguments.vararg, arguments.kwarg) if argument]
    expressions = arguments.defaults + arguments.kw_defaults + [node.returns]
    expressions += [parameter.annotation for parameter in parameters]
    return all(_literal_definition_value(expression) for expression in expressions)


class _PlaybackScope:
    def __init__(self, class_body=False):
        self.class_body = class_body
        self.skipped_lines = set()
        self.executable_lines = set()


class _DefinitionPlayback:
    """AST hints omit definition scaffolding from playback, never from the trace.

    Locations are scoped: an inline function body may share its definition's
    physical line. Unknown/effectful header expressions stay visible. The AST
    is not a general purity analysis, and exception states always stay visible.
    """

    def __init__(self, tree):
        module = _PlaybackScope()
        self.scopes = {("<module>", 1): module}
        self.entered_frames = set()
        self._visit(tree, module)

    def _visit(self, node, scope):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            first_line = min([node.lineno] + [decorator.lineno for decorator in node.decorator_list])
            header = range(first_line, max(node.lineno, node.body[0].lineno - 1) + 1)
            lines = scope.skipped_lines if _passive_definition(node) else scope.executable_lines
            lines.update(header)
            inner = _PlaybackScope(isinstance(node, ast.ClassDef))
            self.scopes[(node.name, first_line)] = inner
            if inner.class_body:
                inner.skipped_lines.add(first_line)  # __module__, __qualname__, etc.
            for index, statement in enumerate(node.body):
                if inner.class_body and index == 0 and isinstance(statement, ast.Expr) and isinstance(
                        statement.value, ast.Constant) and isinstance(statement.value.value, str):
                    inner.skipped_lines.update(range(statement.lineno, statement.end_lineno + 1))
                else:
                    self._visit(statement, inner)
            return
        if isinstance(node, ast.Pass) and scope.class_body:
            scope.skipped_lines.add(node.lineno)
            return
        if hasattr(node, "lineno"):
            scope.executable_lines.add(node.lineno)
        for child in ast.iter_child_nodes(node):
            self._visit(child, scope)

    def should_skip(self, frame, event, unwinding):
        scope = self.scopes.get((frame.f_code.co_name, frame.f_code.co_firstlineno))
        if scope is None or unwinding:
            return False
        if event == "call":
            first_entry = id(frame) not in self.entered_frames
            self.entered_frames.add(id(frame))
            # Generator resumption also produces call events; retain those.
            return first_entry
        if event == "return":
            return scope.class_body
        if event == "line":
            return frame.f_lineno in scope.skipped_lines and frame.f_lineno not in scope.executable_lines
        return False


class _TraceLimit(BaseException):
    pass


class _CapturedOutput(io.TextIOBase):
    """One bounded stream preserves the ordering of stdout and stderr."""

    def __init__(self):
        self.text = ""
        self.truncated = False

    def write(self, text):
        remaining = MAX_OUTPUT_LENGTH - len(self.text)
        self.text += text[:remaining]
        self.truncated = self.truncated or len(text) > remaining
        return len(text)

    def flush(self):
        pass


class _ObjectIdentities:
    """Keep inspected objects alive so Python cannot reuse their identity IDs."""

    def __init__(self):
        self.objects = {}

    def identify(self, value):
        identity = id(value)
        if identity not in self.objects:
            self.objects[identity] = ("o" + str(len(self.objects) + 1), value)
        return self.objects[identity][0]


class _ObjectGraph:
    """Serialize the reachable graph for one instant, preserving shared edges."""

    def __init__(self, identities):
        self.identities = identities
        self.nodes = {}
        self.pending = []
        self.notes = set()

    def reference(self, value, depth=0):
        identity = self.identities.identify(value)
        if identity in self.nodes:
            return identity
        if len(self.nodes) >= MAX_NODES - 1:
            self.nodes["omitted"] = {"id": "omitted", "type": "omitted", "value": "Display limit"}
            self.notes.add("Some references are omitted at the " + str(MAX_NODES) + "-object display limit.")
            return "omitted"
        node = {"id": identity, "type": _class_name(type(value))}
        self.nodes[identity] = node
        self.pending.append((node, value, depth))
        return identity

    def finish(self):
        # Breadth-first expansion displays root bindings before deeply nested data.
        position = 0
        while position < len(self.pending):
            node, value, depth = self.pending[position]
            self._describe(node, value, depth)
            position += 1
        return list(self.nodes.values())

    def _describe(self, node, value, depth):
        literal = _primitive_value(value)
        if literal is not None:
            node["value"] = literal
            return
        entries = self._entries(node, value)
        if entries is None:
            return
        if depth >= MAX_DEPTH:
            node["value"] = "Contents omitted at depth limit"
            self.notes.add("Nested contents beyond " + str(MAX_DEPTH) + " levels are omitted.")
            return
        node["entries"] = []
        for index, (label, child) in enumerate(entries):
            if index >= MAX_ENTRIES:
                node["value"] = "Additional entries omitted"
                self.notes.add("Objects show at most " + str(MAX_ENTRIES) + " entries.")
                break
            node["entries"].append({"label": _clip(label), "target": self.reference(child, depth + 1)})

    def _entries(self, node, value):
        value_type = type(value)
        if value_type is list or value_type is tuple:
            return (("[" + str(index) + "]", child) for index, child in enumerate(value))
        if value_type is dict:
            return self._dictionary_entries(value)
        if value_type is set or value_type is frozenset:
            return (("member " + str(index + 1), child) for index, child in enumerate(value))
        if _is_class(value):
            node["type"] = "class " + _class_name(value)
            module = _TYPE_MODULE.__get__(value)
            if type(module) is str and module == "builtins":
                node["value"] = "Built-in class; attributes not expanded"
                return None
            return self._class_entries(value)
        if value_type is types.FunctionType:
            node["value"] = "function " + value.__name__
            return None
        if value_type is types.ModuleType:
            node["value"] = "Module internals not expanded"
            return None
        attributes = _instance_dictionary(value)
        if attributes is not None:
            return self._instance_entries(value, attributes)
        node["value"] = "Internals not expanded"
        return None

    @staticmethod
    def _dictionary_entries(value):
        for index, (key, child) in enumerate(dict.items(value)):
            yield "key " + str(index + 1), key
            yield "value " + str(index + 1), child

    @staticmethod
    def _attributes(attributes):
        for name, child in attributes.items():
            if type(name) is str and name not in _HIDDEN_ATTRIBUTES:
                yield name, child

    def _instance_entries(self, value, attributes):
        yield "__class__", type(value)
        yield from self._attributes(attributes)

    def _class_entries(self, value):
        yield from self._attributes(_class_dictionary(value))
        for index, base in enumerate(_TYPE_BASES.__get__(value)):
            if base is not object:
                yield "base " + str(index + 1), base


class _ExecutionTrace:
    """Record source execution events as immutable graph snapshots."""

    def __init__(self):
        self.namespace = {"__name__": "__main__", "__builtins__": builtins.__dict__.copy()}
        self.output = _CapturedOutput()
        self.identities = _ObjectIdentities()
        self.steps = []
        self.frame_ids = {}
        self.pending_exceptions = set()
        self.playback = None
        self.line_events = 0
        self.truncated = False
        self.error = None

    def record(self, event, line=0, frame=None, note=None, returned=None, skip_playback=False):
        graph = _ObjectGraph(self.identities)
        scopes = self._scopes(frame, graph, returned)
        objects = graph.finish()
        notes = sorted(graph.notes)
        if note:
            notes.insert(0, note)
        if self.output.truncated:
            notes.append("Output is limited to " + str(MAX_OUTPUT_LENGTH) + " characters.")
        self.truncated = self.truncated or bool(graph.notes) or self.output.truncated
        step = {"line": line, "event": event, "scopes": scopes, "objects": objects, "output": self.output.text}
        if notes:
            step["note"] = " ".join(notes)
        if skip_playback:
            step["skipPlayback"] = True
        self.steps.append(step)

    def _scopes(self, frame, graph, returned):
        scopes = [self._scope("global", "Global names", self.namespace, graph)]
        frames = []
        while frame is not None:
            if frame.f_code.co_filename == SOURCE_FILENAME and frame.f_code.co_name != "<module>":
                frames.append(frame)
            frame = frame.f_back
        if len(frames) > MAX_SCOPES - 1:
            graph.notes.add("Only the innermost " + str(MAX_SCOPES - 1) + " local scopes are shown.")
        for active_frame in reversed(frames[:MAX_SCOPES - 1]):
            identity = id(active_frame)
            if identity not in self.frame_ids:
                # Retain frames too: recursion and later calls must have distinct IDs.
                self.frame_ids[identity] = ("scope" + str(len(self.frame_ids) + 1), active_frame)
            name = active_frame.f_code.co_name
            class_body = _is_class_body(active_frame)
            if class_body:
                name = "class body " + name
            hidden_names = _HIDDEN_CLASS_NAMES if class_body else _HIDDEN_NAMES
            scope = self._scope(self.frame_ids[identity][0], name, active_frame.f_locals, graph, hidden_names)
            if returned is not None and active_frame is frames[0]:
                scope["bindings"].append({"name": "(return value)", "target": graph.reference(returned[0])})
            scopes.append(scope)
        return scopes

    @staticmethod
    def _scope(identity, name, namespace, graph, hidden_names=_HIDDEN_NAMES):
        bindings = []
        for binding, value in namespace.items():
            if type(binding) is not str or binding in hidden_names:
                continue
            if len(bindings) >= MAX_ENTRIES:
                graph.notes.add("Scopes show at most " + str(MAX_ENTRIES) + " bindings.")
                break
            bindings.append({"name": _clip(binding), "target": graph.reference(value)})
        return {"id": identity, "name": name, "bindings": bindings}

    def observe(self, frame, event, argument):
        if frame.f_code.co_filename != SOURCE_FILENAME:
            return None
        if event not in ("line", "call", "return", "exception"):
            return self.observe
        if event == "line":
            self.line_events += 1
            self.pending_exceptions.discard(id(frame))
        if self.line_events > MAX_LINE_EVENTS or len(self.steps) >= MAX_STEPS - 2:
            self.truncated = True
            raise _TraceLimit("Execution stopped at the lab's trace limit (" + str(MAX_LINE_EVENTS) + " executed lines / " + str(MAX_STEPS) + " snapshots).")
        if frame.f_code.co_name == "<module>" and event in ("call", "return"):
            return self.observe
        self._record_event(frame, event, argument)
        return self.observe

    def _record_event(self, frame, event, argument):
        note = None
        returned = None
        skip_playback = self.playback.should_skip(frame, event, id(frame) in self.pending_exceptions)
        if event == "call":
            if _is_class_body(frame):
                note = "Executing class body " + frame.f_code.co_name + "; these bindings become class attributes."
            else:
                note = "Entered " + frame.f_code.co_name + "; arguments are now bound."
        elif event == "return":
            if id(frame) in self.pending_exceptions:
                note = "Leaving " + frame.f_code.co_name + " after an exception."
                self.pending_exceptions.discard(id(frame))
            elif _is_class_body(frame):
                note = "Finished class body " + frame.f_code.co_name + "."
            else:
                note = "Returning from " + frame.f_code.co_name + "."
                returned = (argument,)
        elif event == "exception":
            self.pending_exceptions.add(id(frame))
            note = _error_text(argument[1]) + " (the program may handle this exception)."
        self.record(event, frame.f_lineno, frame, note, returned, skip_playback)

    def execute(self, source):
        self.record("initial", note="Before execution; no user names are bound.")
        previous_trace = sys.gettrace()
        try:
            if type(source) is not str or len(source) > MAX_SOURCE_LENGTH:
                raise ValueError("Enter Python code of at most " + str(MAX_SOURCE_LENGTH) + " characters.")
            program = compile(source, SOURCE_FILENAME, "exec")
            self.playback = _DefinitionPlayback(ast.parse(source, SOURCE_FILENAME))
            with redirect_stdout(self.output), redirect_stderr(self.output):
                sys.settrace(self.observe)
                exec(program, self.namespace, self.namespace)
        except BaseException as error:
            self.error = _error_text(error)
            error_line = self._error_line(error)
            self.record("error", error_line, note=self.error)
        finally:
            sys.settrace(previous_trace)
        self.record("final", note="Execution stopped." if self.error else "Execution finished.")
        return {"steps": self.steps, "error": self.error, "truncated": self.truncated}

    @staticmethod
    def _error_line(error):
        if any(base is SyntaxError for base in _class_mro(type(error))):
            return SyntaxError.__dict__["lineno"].__get__(error) or 0
        traceback = _EXCEPTION_TRACEBACK.__get__(error)
        line = 0
        while traceback is not None:
            if traceback.tb_frame.f_code.co_filename == SOURCE_FILENAME:
                line = traceback.tb_lineno
            traceback = traceback.tb_next
        return line


def trace_code(source):
    """Execute source and return bounded JSON snapshots; errors retain partial work.

    Line events show the state BEFORE the indicated line executes. Call/return
    events expose local bindings. Optional skipPlayback hints identify definition
    scaffolding; every raw state is retained. The final event always has line 0. Builtin
    containers, ordinary instance dictionaries, and class attributes are drawn;
    unsupported internals stay opaque. Logical IDs describe actual interpreter
    identity, including any immutable-object interning. This is an educational
    tracer, not a security sandbox for hostile code. Retaining inspected objects
    postpones their cleanup, so reference counts and destructor timing may differ.
    """
    return json.dumps(_ExecutionTrace().execute(source), ensure_ascii=True)
