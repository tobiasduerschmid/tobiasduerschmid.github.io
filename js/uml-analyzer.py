"""
UML Diagram Analyzer — extracts class diagrams and sequence diagrams from Python source.

Runs inside Pyodide. Receives a dict of {filename: source_code} via global `__uml_sources`,
prints a JSON result with Mermaid syntax for both diagram types.
"""
import ast
import json
import sys


class ClassInfo:
    def __init__(self, name, bases, filename):
        self.name = name
        self.bases = bases
        self.filename = filename
        self.methods = []       # [(name, params, is_private)]
        self.attributes = []    # [(name, type_hint_or_None)]
        self.compositions = []  # [class_name] — from type hints or Foo() calls in __init__


class ClassVisitor(ast.NodeVisitor):
    """Extract class definitions, methods, attributes, and relationships."""

    def __init__(self, filename, all_class_names):
        self.filename = filename
        self.all_class_names = all_class_names
        self.classes = []
        self._current_class = None
        self._current_method = None

    def visit_ClassDef(self, node):
        bases = []
        for base in node.bases:
            if isinstance(base, ast.Name):
                bases.append(base.id)
            elif isinstance(base, ast.Attribute):
                bases.append(ast.dump(base))  # fallback for module.Class
        info = ClassInfo(node.name, bases, self.filename)
        self.classes.append(info)

        prev_class = self._current_class
        self._current_class = info

        for item in node.body:
            if isinstance(item, ast.FunctionDef) or isinstance(item, ast.AsyncFunctionDef):
                self._visit_method(item)
            else:
                self.visit(item)

        self._current_class = prev_class

    def _visit_method(self, node):
        if not self._current_class:
            return
        params = []
        for arg in node.args.args:
            if arg.arg != 'self' and arg.arg != 'cls':
                hint = ''
                if arg.annotation:
                    hint = self._annotation_str(arg.annotation)
                params.append(arg.arg + (': ' + hint if hint else ''))

        is_private = node.name.startswith('_') and not node.name.startswith('__')
        self._current_class.methods.append((node.name, params, is_private))

        prev_method = self._current_method
        self._current_method = node.name

        # Scan body for self.x assignments and composition patterns
        for child in ast.walk(node):
            self._check_attribute(child)
            self._check_composition(child)

        self._current_method = prev_method

    def _check_attribute(self, node):
        """Detect self.x = ... assignments in methods."""
        if not self._current_class:
            return
        if isinstance(node, ast.Assign):
            for target in node.targets:
                self._extract_self_attr(target, node.value)
        elif isinstance(node, ast.AnnAssign) and node.target:
            self._extract_self_attr(node.target, node.value, annotation=node.annotation)

    def _extract_self_attr(self, target, value, annotation=None):
        if not self._current_class:
            return
        if (isinstance(target, ast.Attribute) and
                isinstance(target.value, ast.Name) and
                target.value.id == 'self'):
            attr_name = target.attr
            type_hint = None
            if annotation:
                type_hint = self._annotation_str(annotation)
            # Avoid duplicates
            existing = [a[0] for a in self._current_class.attributes]
            if attr_name not in existing:
                self._current_class.attributes.append((attr_name, type_hint))

    def _check_composition(self, node):
        """Detect self.x = Foo() or self.x: Foo = Foo() patterns."""
        if not self._current_class:
            return
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if (isinstance(target, ast.Attribute) and
                        isinstance(target.value, ast.Name) and
                        target.value.id == 'self'):
                    if isinstance(node.value, ast.Call):
                        callee = self._call_name(node.value)
                        if callee and callee in self.all_class_names:
                            if callee not in self._current_class.compositions:
                                self._current_class.compositions.append(callee)
        elif isinstance(node, ast.AnnAssign) and node.target:
            if (isinstance(node.target, ast.Attribute) and
                    isinstance(node.target.value, ast.Name) and
                    node.target.value.id == 'self'):
                if node.annotation:
                    type_name = self._annotation_str(node.annotation)
                    if type_name in self.all_class_names:
                        if type_name not in self._current_class.compositions:
                            self._current_class.compositions.append(type_name)

    def _call_name(self, node):
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name):
                return node.func.id
            elif isinstance(node.func, ast.Attribute):
                return node.func.attr
        return None

    def _annotation_str(self, node):
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Constant):
            return str(node.value)
        elif isinstance(node, ast.Attribute):
            return self._annotation_str(node.value) + '.' + node.attr
        elif isinstance(node, ast.Subscript):
            return self._annotation_str(node.value) + '[' + self._annotation_str(node.slice) + ']'
        return ''


class CallVisitor(ast.NodeVisitor):
    """Extract method call sequences for sequence diagrams."""

    def __init__(self, all_class_names):
        self.all_class_names = all_class_names
        self.calls = []  # [(caller_class, caller_method, callee_class, callee_method)]
        self._current_class = None
        self._current_method = None
        # Maps attribute names to class names from self.x = Foo() patterns
        self._attr_types = {}

    def visit_ClassDef(self, node):
        prev = self._current_class
        self._current_class = node.name
        self._attr_types = {}
        self.generic_visit(node)
        self._current_class = prev

    def visit_FunctionDef(self, node):
        prev = self._current_method
        self._current_method = node.name
        # In __init__, build attr type map
        if node.name == '__init__' and self._current_class:
            for child in ast.walk(node):
                if isinstance(child, ast.Assign):
                    for target in child.targets:
                        if (isinstance(target, ast.Attribute) and
                                isinstance(target.value, ast.Name) and
                                target.value.id == 'self' and
                                isinstance(child.value, ast.Call)):
                            func = child.value.func
                            if isinstance(func, ast.Name) and func.id in self.all_class_names:
                                self._attr_types[target.attr] = func.id
        self.generic_visit(node)
        self._current_method = prev

    visit_AsyncFunctionDef = visit_FunctionDef

    def visit_Call(self, node):
        if self._current_class and self._current_method:
            # self.attr.method() pattern
            if (isinstance(node.func, ast.Attribute) and
                    isinstance(node.func.value, ast.Attribute) and
                    isinstance(node.func.value.value, ast.Name) and
                    node.func.value.value.id == 'self'):
                attr_name = node.func.value.attr
                method_name = node.func.attr
                if attr_name in self._attr_types:
                    callee_class = self._attr_types[attr_name]
                    self.calls.append((
                        self._current_class, self._current_method,
                        callee_class, method_name
                    ))

            # Direct ClassName.method() or ClassName() calls
            elif isinstance(node.func, ast.Name):
                if node.func.id in self.all_class_names:
                    self.calls.append((
                        self._current_class, self._current_method,
                        node.func.id, '__init__'
                    ))

            # super().method() pattern
            elif (isinstance(node.func, ast.Attribute) and
                  isinstance(node.func.value, ast.Call) and
                  isinstance(node.func.value.func, ast.Name) and
                  node.func.value.func.id == 'super'):
                method_name = node.func.attr
                self.calls.append((
                    self._current_class, self._current_method,
                    'super', method_name
                ))

        self.generic_visit(node)


class TopLevelCallVisitor(ast.NodeVisitor):
    """Find calls and variable assignments in top-level / __main__ code."""

    def __init__(self, all_class_names):
        self.all_class_names = all_class_names
        self.calls = []       # [(var_name_or_None, callee_class, callee_method)]
        self.var_types = {}   # {var_name: class_name}  from var = ClassName(...)
        self._in_main = False

    def visit_ClassDef(self, node):
        pass  # Skip class bodies

    def visit_FunctionDef(self, node):
        pass  # Skip function bodies

    def visit_If(self, node):
        if self._is_main_guard(node):
            self._in_main = True
            for child in node.body:
                self.visit(child)
            self._in_main = False
        else:
            self.generic_visit(node)

    def _is_main_guard(self, node):
        if isinstance(node.test, ast.Compare):
            left = node.test.left
            if (isinstance(left, ast.Name) and left.id == '__name__' and
                    len(node.test.comparators) == 1):
                comp = node.test.comparators[0]
                if isinstance(comp, ast.Constant) and comp.value == '__main__':
                    return True
        return False

    def visit_Assign(self, node):
        """Track var = ClassName(...) assignments."""
        if isinstance(node.value, ast.Call):
            if isinstance(node.value.func, ast.Name):
                class_name = node.value.func.id
                if class_name in self.all_class_names:
                    for target in node.targets:
                        if isinstance(target, ast.Name):
                            var_name = target.id
                            self.var_types[var_name] = class_name
                            self.calls.append((var_name, class_name, '__init__'))
                            return
            # Not a known class — still visit children
        self.generic_visit(node)

    def visit_Expr(self, node):
        """Track standalone calls like var.method()."""
        if isinstance(node.value, ast.Call):
            call = node.value
            if isinstance(call.func, ast.Attribute):
                if isinstance(call.func.value, ast.Name):
                    var_name = call.func.value.id
                    method_name = call.func.attr
                    if var_name in self.var_types:
                        self.calls.append((None, var_name, method_name))
                        return
            elif isinstance(call.func, ast.Name):
                if call.func.id in self.all_class_names:
                    self.calls.append((None, call.func.id, '__init__'))
                    return
        self.generic_visit(node)


def _escape_mermaid(s):
    """Escape characters that break Mermaid syntax."""
    return s.replace('"', "'").replace('<', '&lt;').replace('>', '&gt;')


def _topo_sort_classes(all_classes):
    """Sort classes so superclasses come before subclasses (topological order)."""
    class_map = {c.name: c for c in all_classes}
    visited = set()
    order = []

    def visit(cls):
        if cls.name in visited:
            return
        visited.add(cls.name)
        for base in cls.bases:
            if base in class_map:
                visit(class_map[base])
        order.append(cls)

    for cls in all_classes:
        visit(cls)
    return order


def _is_abstract_class(cls):
    """Check if a class is abstract (has ABC base or @abstractmethod decorators)."""
    for base in cls.bases:
        if base in ('ABC', 'ABCMeta'):
            return True
    # Check for abstract methods
    for method_name, params, is_private in cls.methods:
        # This is a heuristic; real detection would need AST decorator info
        pass
    return False


def _is_interface(cls):
    """Check if a class looks like an interface (only abstract methods, no attributes)."""
    if not _is_abstract_class(cls):
        return False
    if cls.attributes:
        return False
    return True


def generate_class_diagram(all_classes):
    """Generate UML class diagram text in custom format for the SVG renderer."""
    lines = ['@startuml']

    sorted_classes = _topo_sort_classes(all_classes)

    for cls in sorted_classes:
        # Determine class type
        if _is_interface(cls):
            decl = 'interface ' + cls.name
        elif _is_abstract_class(cls):
            decl = 'abstract class ' + cls.name
        else:
            decl = 'class ' + cls.name

        lines.append(decl + ' {')

        # Attributes
        for attr_name, type_hint in cls.attributes:
            prefix = '-' if attr_name.startswith('_') else '+'
            if type_hint:
                lines.append('  ' + prefix + attr_name + ': ' + type_hint)
            else:
                lines.append('  ' + prefix + attr_name)

        # Methods
        for method_name, params, is_private in cls.methods:
            prefix = '-' if is_private else '+'
            param_str = ', '.join(params)
            lines.append('  ' + prefix + method_name + '(' + param_str + ')')

        lines.append('}')

    # Relationships
    for cls in sorted_classes:
        for base in cls.bases:
            if base in ('ABC', 'ABCMeta'):
                continue  # Skip ABC as a base — it's a marker, not a real parent
            if any(c.name == base for c in all_classes):
                lines.append(cls.name + ' --|> ' + base)
        for comp in cls.compositions:
            lines.append(cls.name + ' *-- ' + comp)

    lines.append('@enduml')
    return '\n'.join(lines)


def generate_sequence_diagram(class_calls, top_calls, top_var_types, all_class_names):
    """Generate Mermaid sequenceDiagram syntax with proper UML notation.

    Uses :ClassName notation for instances (var: ClassName) and <<create>> for construction.
    """
    lines = ['sequenceDiagram']
    lines.append('  participant Main')

    # Build participant list with :ClassName notation
    # Track which participants have been declared
    declared = {'Main'}  # Main is always declared
    call_lines = []

    # Process top-level calls in order (preserves code sequence)
    for item in top_calls:
        var_name, target, method = item

        if method == '__init__':
            # Object creation: var = ClassName(...)
            if target in all_class_names:
                # Participant name: "var: ClassName" or just ":ClassName"
                if var_name:
                    participant_id = var_name
                    participant_label = var_name + ': ' + target
                else:
                    participant_id = target
                    participant_label = ':' + target
                if participant_id not in declared:
                    declared.add(participant_id)
                    # Use create + dashed open arrow for UML create message
                    call_lines.append('  create participant ' + participant_id + ' as ' + participant_label)
                    call_lines.append('  Main-->' + participant_id + ': <<create>>')
                else:
                    call_lines.append('  Main-->' + participant_id + ': <<create>>')
        else:
            # Method call: var.method()
            caller_id = 'Main'
            # target is the variable name here
            callee_id = target
            if callee_id not in declared:
                # Resolve variable to class name
                class_name = top_var_types.get(target, target)
                participant_label = target + ': ' + class_name if class_name != target else ':' + target
                declared.add(callee_id)
                lines.append('  participant ' + callee_id + ' as ' + participant_label)
            call_lines.append('  ' + caller_id + '->>' + callee_id + ': ' + _escape_mermaid(method) + '()')

    # Inter-class method calls
    seen_inter = set()
    for caller, caller_m, callee, callee_m in class_calls:
        if callee == 'super':
            continue
        call_key = (caller, callee, callee_m)
        if call_key in seen_inter:
            continue
        seen_inter.add(call_key)

        # Ensure caller participant exists
        if caller not in declared:
            declared.add(caller)
            lines.append('  participant ' + caller + ' as :' + caller)
        if callee not in declared:
            declared.add(callee)
            lines.append('  participant ' + callee + ' as :' + callee)

        if callee_m == '__init__':
            call_lines.append('  ' + caller + '-->' + callee + ': <<create>>')
        else:
            call_lines.append('  ' + caller + '->>' + callee + ': ' + _escape_mermaid(callee_m) + '()')

    if not call_lines:
        return ''

    lines.extend(call_lines)
    return '\n'.join(lines)


def analyze(sources):
    """
    Analyze Python sources and return Mermaid diagram syntax.

    Args:
        sources: dict of {filename: source_code_string}

    Returns:
        dict with classDiagram, sequenceDiagram, errors
    """
    errors = []
    trees = {}

    # Parse all files
    for filename, code in sources.items():
        try:
            trees[filename] = ast.parse(code, filename=filename)
        except SyntaxError as e:
            errors.append(f"{filename}:{e.lineno}: {e.msg}")

    # First pass: collect all class names
    all_class_names = set()
    for filename, tree in trees.items():
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                all_class_names.add(node.name)

    # Second pass: extract class info
    all_classes = []
    for filename, tree in trees.items():
        visitor = ClassVisitor(filename, all_class_names)
        visitor.visit(tree)
        all_classes.extend(visitor.classes)

    # Third pass: extract call graph
    all_calls = []
    all_top_calls = []
    all_top_var_types = {}
    for filename, tree in trees.items():
        cv = CallVisitor(all_class_names)
        cv.visit(tree)
        all_calls.extend(cv.calls)

        tv = TopLevelCallVisitor(all_class_names)
        tv.visit(tree)
        all_top_calls.extend(tv.calls)
        all_top_var_types.update(tv.var_types)

    class_diagram = generate_class_diagram(all_classes) if all_classes else ''
    sequence_diagram = generate_sequence_diagram(
        all_calls, all_top_calls, all_top_var_types, all_class_names
    ) if all_classes else ''

    return {
        'classDiagram': class_diagram,
        'sequenceDiagram': sequence_diagram,
        'errors': errors,
    }


# Entry point: read __uml_sources global set by the JS bridge
if '__uml_sources' in dir():
    result = analyze(__uml_sources)
