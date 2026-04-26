import ast
import json
import sys


def _seg(src, node):
    try:
        return ast.get_source_segment(src, node) or ""
    except Exception:
        return ""


def _line(src, lineno):
    lines = src.splitlines()
    return lines[lineno - 1] if 1 <= lineno <= len(lines) else ""


def _name_col(src, node, name):
    line = _line(src, node.lineno)
    idx = line.find(name, getattr(node, "col_offset", 0))
    if idx < 0:
        idx = line.find(name)
    return idx if idx >= 0 else getattr(node, "col_offset", 0)


def _range(node, name=None, src=None):
    line = getattr(node, "lineno", 1)
    col = getattr(node, "col_offset", 0)
    end_line = getattr(node, "end_lineno", line)
    end_col = getattr(node, "end_col_offset", col)
    if name and src:
        col = _name_col(src, node, name)
        end_col = col + len(name)
        end_line = line
    return {"startLine": line, "startCol": col, "endLine": end_line, "endCol": end_col}


def _annotation(src, node):
    ann = getattr(node, "annotation", None)
    return _seg(src, ann).strip() if ann is not None else ""


def _arg_text(src, arg, default=None):
    text = arg.arg
    ann = _annotation(src, arg)
    if ann:
        text += ": " + ann
    if default is not None:
        text += " = " + _seg(src, default).strip()
    return text


def _decorator_texts(src, node):
    return [_seg(src, dec).strip() for dec in getattr(node, "decorator_list", [])]


class Analyzer(ast.NodeVisitor):
    def __init__(self, filename, src):
        self.filename = filename
        self.src = src
        self.classes = []
        self.functions = []
        self.calls = []
        self.assignments = []
        self.imports = []
        self.statements = []
        self.symbols = []
        self.statement_keys = set()
        self.class_stack = []
        self.function_stack = []

    def _scope(self):
        return self.function_stack[-1]["name"] if self.function_stack else None

    def _class(self):
        return self.class_stack[-1]["name"] if self.class_stack else None

    def visit_ClassDef(self, node):
        item = {
            "name": node.name,
            "filename": self.filename,
            "range": _range(node, node.name, self.src),
            "startLine": node.lineno,
            "endLine": getattr(node, "end_lineno", node.lineno),
            "col": node.col_offset,
            "decorators": _decorator_texts(self.src, node),
        }
        self.classes.append(item)
        self.symbols.append({
            "name": node.name,
            "kind": "class",
            "ctx": "def",
            "filename": self.filename,
            "scope": self._scope(),
            "className": self._class(),
            "range": item["range"],
        })
        self.class_stack.append(item)
        self.generic_visit(node)
        self.class_stack.pop()

    def visit_Import(self, node):
        self.imports.append({
            "kind": "import",
            "filename": self.filename,
            "module": "",
            "names": [alias.name for alias in node.names],
            "aliases": [{"name": alias.name, "asname": alias.asname or ""} for alias in node.names],
            "range": _range(node),
        })
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        self.imports.append({
            "kind": "from",
            "filename": self.filename,
            "module": node.module or "",
            "names": [alias.name for alias in node.names],
            "aliases": [{"name": alias.name, "asname": alias.asname or ""} for alias in node.names],
            "range": _range(node),
        })
        self.generic_visit(node)

    def _visit_function(self, node, async_kind=False):
        defaults = list(getattr(node.args, "defaults", []) or [])
        positional = list(node.args.args)
        default_offset = len(positional) - len(defaults)
        params = []
        for i, arg in enumerate(positional):
            default = defaults[i - default_offset] if i >= default_offset else None
            params.append({
                "name": arg.arg,
                "annotation": _annotation(self.src, arg),
                "default": _seg(self.src, default).strip() if default is not None else "",
                "kind": "positional",
                "text": _arg_text(self.src, arg, default),
                "range": _range(arg, arg.arg, self.src),
            })
        if node.args.vararg:
            arg = node.args.vararg
            params.append({
                "name": arg.arg,
                "annotation": _annotation(self.src, arg),
                "default": "",
                "kind": "vararg",
                "text": "*" + _arg_text(self.src, arg),
                "range": _range(arg, arg.arg, self.src),
            })
        kw_defaults = list(getattr(node.args, "kw_defaults", []) or [])
        for i, arg in enumerate(node.args.kwonlyargs):
            default = kw_defaults[i] if i < len(kw_defaults) else None
            params.append({
                "name": arg.arg,
                "annotation": _annotation(self.src, arg),
                "default": _seg(self.src, default).strip() if default is not None else "",
                "kind": "kwonly",
                "text": _arg_text(self.src, arg, default),
                "range": _range(arg, arg.arg, self.src),
            })
        if node.args.kwarg:
            arg = node.args.kwarg
            params.append({
                "name": arg.arg,
                "annotation": _annotation(self.src, arg),
                "default": "",
                "kind": "kwarg",
                "text": "**" + _arg_text(self.src, arg),
                "range": _range(arg, arg.arg, self.src),
            })
        current_class = self.class_stack[-1] if self.class_stack else None
        item = {
            "name": node.name,
            "filename": self.filename,
            "className": self._class(),
            "range": _range(node, node.name, self.src),
            "startLine": node.lineno,
            "endLine": getattr(node, "end_lineno", node.lineno),
            "col": node.col_offset,
            "params": params,
            "returns": _seg(self.src, node.returns).strip() if node.returns else "",
            "async": bool(async_kind),
            "classStartLine": current_class["startLine"] if current_class else None,
            "decorators": _decorator_texts(self.src, node),
        }
        self.functions.append(item)
        self.symbols.append({
            "name": node.name,
            "kind": "function",
            "ctx": "def",
            "filename": self.filename,
            "scope": self._scope(),
            "className": self._class(),
            "range": item["range"],
        })
        self.function_stack.append(item)
        for param in params:
            self.symbols.append({
                "name": param["name"],
                "kind": "parameter",
                "ctx": "param",
                "filename": self.filename,
                "scope": node.name,
                "className": self._class(),
                "range": param["range"],
            })
        self.generic_visit(node)
        self.function_stack.pop()

    def visit_FunctionDef(self, node):
        self._visit_function(node, False)

    def visit_AsyncFunctionDef(self, node):
        self._visit_function(node, True)

    def visit_Name(self, node):
        ctx = type(node.ctx).__name__.lower()
        self.symbols.append({
            "name": node.id,
            "kind": "name",
            "ctx": ctx,
            "filename": self.filename,
            "scope": self._scope(),
            "className": self._class(),
            "range": _range(node),
        })

    def visit_Attribute(self, node):
        seg = _seg(self.src, node)
        attr_col = getattr(node, "end_col_offset", getattr(node, "col_offset", 0)) - len(node.attr)
        if seg:
            dot_idx = seg.rfind("." + node.attr)
            if dot_idx >= 0:
                attr_col = getattr(node, "col_offset", 0) + dot_idx + 1
        self.symbols.append({
            "name": node.attr,
            "kind": "attribute",
            "ctx": type(node.ctx).__name__.lower(),
            "filename": self.filename,
            "scope": self._scope(),
            "className": self._class(),
            "range": {
                "startLine": node.lineno,
                "startCol": attr_col,
                "endLine": node.lineno,
                "endCol": attr_col + len(node.attr),
            },
            "receiver": _seg(self.src, node.value),
        })
        self.generic_visit(node)

    def visit_Call(self, node):
        call = {
            "filename": self.filename,
            "range": _range(node),
            "args": [],
            "keywords": [],
            "name": "",
            "receiver": "",
            "scope": self._scope(),
            "className": self._class(),
        }
        if isinstance(node.func, ast.Name):
            call["name"] = node.func.id
        elif isinstance(node.func, ast.Attribute):
            call["name"] = node.func.attr
            call["receiver"] = _seg(self.src, node.func.value)
        for arg in node.args:
            call["args"].append({"text": _seg(self.src, arg), "range": _range(arg)})
        for kw in node.keywords:
            keyword = {
                "name": kw.arg or "",
                "text": _seg(self.src, kw.value),
                "range": _range(kw.value),
            }
            if kw.arg:
                keyword["nameRange"] = _range(kw, kw.arg, self.src)
            call["keywords"].append(keyword)
        self.calls.append(call)
        self.generic_visit(node)

    def _value_kind(self, node):
        if node is None:
            return "none"
        if isinstance(node, ast.Constant):
            return "literal"
        if isinstance(node, (ast.List, ast.Tuple, ast.Set)) and len(node.elts) == 0:
            return "literal"
        if isinstance(node, ast.Dict) and len(node.keys) == 0:
            return "literal"
        if isinstance(node, ast.Call):
            return "call"
        return "complex"

    def _record_assignment(self, node, target, value, annotation=None):
        if isinstance(target, ast.Attribute) and isinstance(target.value, ast.Name):
            self.assignments.append({
                "filename": self.filename,
                "name": target.attr,
                "receiver": target.value.id,
                "target": _seg(self.src, target),
                "value": _seg(self.src, value).strip() if value is not None else "",
                "annotation": _seg(self.src, annotation).strip() if annotation is not None else "",
                "valueKind": self._value_kind(value),
                "scope": self._scope(),
                "className": self._class(),
                "range": _range(node),
                "targetRange": _range(target),
                "valueRange": _range(value) if value is not None else None,
            })
        elif isinstance(target, ast.Name):
            self.assignments.append({
                "filename": self.filename,
                "name": target.id,
                "receiver": "",
                "target": _seg(self.src, target),
                "value": _seg(self.src, value).strip() if value is not None else "",
                "annotation": _seg(self.src, annotation).strip() if annotation is not None else "",
                "valueKind": self._value_kind(value),
                "scope": self._scope(),
                "className": self._class(),
                "range": _range(node),
                "targetRange": _range(target),
                "valueRange": _range(value) if value is not None else None,
            })

    def visit_Assign(self, node):
        for target in node.targets:
            self._record_assignment(node, target, node.value)
        self.generic_visit(node)

    def visit_AnnAssign(self, node):
        self._record_assignment(node, node.target, node.value, node.annotation)
        self.generic_visit(node)

    def _record_statement(self, node, kind):
        statement_range = _range(node)
        key = (
            kind,
            statement_range["startLine"],
            statement_range["startCol"],
            statement_range["endLine"],
            statement_range["endCol"],
        )
        if key in self.statement_keys:
            return
        self.statement_keys.add(key)
        self.statements.append({
            "filename": self.filename,
            "kind": kind,
            "range": statement_range,
            "scope": self._scope(),
            "className": self._class(),
        })

    def visit(self, node):
        if isinstance(node, ast.stmt):
            self._record_statement(node, type(node).__name__.lower())
        return super().visit(node)

    def visit_Return(self, node):
        self._record_statement(node, "return")
        self.generic_visit(node)

    def visit_Raise(self, node):
        self._record_statement(node, "raise")
        self.generic_visit(node)

    def visit_Break(self, node):
        self._record_statement(node, "break")

    def visit_Continue(self, node):
        self._record_statement(node, "continue")

    def visit_Pass(self, node):
        self._record_statement(node, "pass")

    def visit_Yield(self, node):
        self._record_statement(node, "yield")
        self.generic_visit(node)

    def visit_YieldFrom(self, node):
        self._record_statement(node, "yield")
        self.generic_visit(node)


def analyze_files(files_json):
    files = json.loads(files_json)
    result = {"files": {}, "errors": []}
    for item in files:
        filename = item.get("filename", "")
        src = item.get("content", "")
        try:
            tree = ast.parse(src, filename=filename, type_comments=True)
            analyzer = Analyzer(filename, src)
            analyzer.visit(tree)
            result["files"][filename] = {
                "classes": analyzer.classes,
                "functions": analyzer.functions,
                "calls": analyzer.calls,
                "assignments": analyzer.assignments,
                "imports": analyzer.imports,
                "statements": analyzer.statements,
                "symbols": analyzer.symbols,
            }
        except Exception as exc:
            result["errors"].append({"filename": filename, "message": str(exc)})
            result["files"][filename] = {
                "classes": [],
                "functions": [],
                "calls": [],
                "assignments": [],
                "imports": [],
                "statements": [],
                "symbols": [],
            }
    return json.dumps(result)


if __name__ == "__main__" and sys.platform != "emscripten":
    sys.stdout.write(analyze_files(sys.stdin.read()))
