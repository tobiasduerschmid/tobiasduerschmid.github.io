"""
UML Diagram Analyzer — extracts class diagrams and sequence diagrams from Python source.

Runs inside Pyodide. Receives a dict of {filename: source_code} via global `__uml_sources`,
produces a JSON result with custom @startuml/@enduml syntax for the SVG renderers.
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
        self.compositions = []  # [class_name] — object created internally (strong ownership)
        self.aggregations = []  # [class_name] — object injected from outside (weak ownership)
        self.associations = []  # [class_name] — reference without clear ownership semantics
        self.dependencies = []  # [class_name] — used in method params/locals/returns
        self._rel_attrs = set() # attribute names promoted to relationship arrows


class ClassVisitor(ast.NodeVisitor):
    """Extract class definitions, methods, attributes, and relationships.

    Relationship inference based on:
    - Milanova (2007) "Composition inference for UML class diagrams"
      DOI: 10.1007/s10515-007-0010-8
    - SEKE 2021 "Mapping OO relationships to UML relationships"
      DOI: 10.18293/SEKE2021-170

    Key heuristics:
    - Composition: self.x = ClassName() — object created internally
    - Aggregation: self.x = param (where param is a typed __init__ arg) — injected
    - Association: self.x: ClassName (annotation only, no init value) — reference
    - Dependency: method parameter/return/local of known class type — transient use
    """

    # Container types whose first subscript argument holds the element class
    _CONTAINER_TYPES = {'List', 'list', 'Set', 'set', 'Tuple', 'tuple',
                        'FrozenSet', 'frozenset', 'Sequence', 'Iterable',
                        'Collection', 'Deque', 'deque'}
    _OPTIONAL_TYPES = {'Optional'}
    _MAPPING_TYPES = {'Dict', 'dict', 'Mapping', 'DefaultDict', 'OrderedDict'}

    def __init__(self, filename, all_class_names):
        self.filename = filename
        self.all_class_names = all_class_names
        self.classes = []
        self._current_class = None
        self._current_method = None
        self._init_param_types = {}  # {param_name: class_name} for current __init__

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

        # After visiting all methods, collect dependencies from method signatures
        self._collect_dependencies(node)

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

        # For __init__, build a map of parameter names to their class types
        saved_init_params = self._init_param_types
        if node.name == '__init__':
            self._init_param_types = {}
            for arg in node.args.args:
                if arg.arg in ('self', 'cls'):
                    continue
                if arg.annotation:
                    cls_name = self._extract_class_from_annotation(arg.annotation)
                    if cls_name:
                        self._init_param_types[arg.arg] = cls_name
        else:
            self._init_param_types = {}

        # Scan body for self.x assignments and relationship patterns
        for child in ast.walk(node):
            self._check_attribute(child)
            self._check_field_relationship(child)

        self._init_param_types = saved_init_params
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

    def _check_field_relationship(self, node):
        """Classify self.x assignments as composition, aggregation, or association.

        Based on Milanova (2007) ownership model and SEKE 2021 mappings:
        - self.x = ClassName()          → Composition (created internally)
        - self.x = param (typed init)   → Aggregation (injected from outside)
        - self.x: ClassName (no value)  → Association (reference only)
        - self.x: ClassName = ClassName()  → Composition
        - self.x: ClassName = param        → Aggregation
        """
        if not self._current_class:
            return
        cls = self._current_class

        if isinstance(node, ast.Assign):
            for target in node.targets:
                if not self._is_self_attr(target):
                    continue
                attr_name = target.attr
                # self.x = ClassName() → composition
                if isinstance(node.value, ast.Call):
                    callee = self._call_name(node.value)
                    if callee and callee in self.all_class_names:
                        self._add_unique(cls.compositions, callee)
                        cls._rel_attrs.add(attr_name)
                        continue
                # self.x = param → aggregation if param is a typed __init__ arg
                if isinstance(node.value, ast.Name):
                    param_cls = self._init_param_types.get(node.value.id)
                    if param_cls:
                        self._add_unique(cls.aggregations, param_cls)
                        cls._rel_attrs.add(attr_name)

        elif isinstance(node, ast.AnnAssign) and node.target:
            if not self._is_self_attr(node.target):
                return
            attr_name = node.target.attr
            ann_cls = self._extract_class_from_annotation(node.annotation) if node.annotation else None

            if node.value:
                # self.x: T = ClassName() → composition
                if isinstance(node.value, ast.Call):
                    callee = self._call_name(node.value)
                    if callee and callee in self.all_class_names:
                        self._add_unique(cls.compositions, callee)
                        cls._rel_attrs.add(attr_name)
                        return
                # self.x: T = param → aggregation if param is a typed __init__ arg
                if isinstance(node.value, ast.Name):
                    param_cls = self._init_param_types.get(node.value.id)
                    if param_cls:
                        self._add_unique(cls.aggregations, param_cls)
                        cls._rel_attrs.add(attr_name)
                        return
                # self.x: T = <other expr> — use annotation type as association
                if ann_cls:
                    self._add_unique(cls.associations, ann_cls)
                    cls._rel_attrs.add(attr_name)
            else:
                # self.x: ClassName (annotation only, no value) → association
                if ann_cls:
                    self._add_unique(cls.associations, ann_cls)
                    cls._rel_attrs.add(attr_name)

    def _collect_dependencies(self, class_node):
        """Collect dependency relationships from method signatures and local usage.

        Dependencies come from:
        - Method parameter type annotations (non-__init__ params that aren't stored)
        - Return type annotations referencing known classes
        - Local variable ClassName() calls not assigned to self
        """
        if not self._current_class:
            return
        cls = self._current_class
        # Classes already in structural relationships
        structural = set(cls.compositions + cls.aggregations + cls.associations)
        structural.update(cls.bases)

        for item in class_node.body:
            if not isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue

            # Method parameter types → dependency
            for arg in item.args.args:
                if arg.arg in ('self', 'cls'):
                    continue
                if arg.annotation:
                    param_cls = self._extract_class_from_annotation(arg.annotation)
                    if param_cls and param_cls not in structural:
                        # __init__ params that became aggregations are already structural
                        if item.name == '__init__' and param_cls in cls.aggregations:
                            continue
                        self._add_unique(cls.dependencies, param_cls)

            # Return type → dependency
            if item.returns:
                ret_cls = self._extract_class_from_annotation(item.returns)
                if ret_cls and ret_cls not in structural:
                    self._add_unique(cls.dependencies, ret_cls)

            # Local ClassName() calls not assigned to self → dependency
            if item.name != '__init__':
                for child in ast.walk(item):
                    if isinstance(child, ast.Assign):
                        for tgt in child.targets:
                            if isinstance(tgt, ast.Name) and isinstance(child.value, ast.Call):
                                callee = self._call_name(child.value)
                                if callee and callee in self.all_class_names and callee not in structural:
                                    self._add_unique(cls.dependencies, callee)

    def _extract_class_from_annotation(self, node):
        """Extract a known class name from a type annotation, unwrapping containers.

        Handles: ClassName, List[ClassName], Optional[ClassName], Dict[K, ClassName]
        Returns the class name if it's in all_class_names, else None.
        """
        if isinstance(node, ast.Name):
            if node.id in self.all_class_names:
                return node.id
            return None
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            if node.value in self.all_class_names:
                return node.value
            return None
        if isinstance(node, ast.Subscript):
            wrapper = self._annotation_str(node.value) if isinstance(node.value, ast.Name) else ''
            # List[X], Set[X], Optional[X], etc. — extract inner type
            if wrapper in self._CONTAINER_TYPES or wrapper in self._OPTIONAL_TYPES:
                return self._extract_class_from_annotation(node.slice)
            # Dict[K, V] — extract value type
            if wrapper in self._MAPPING_TYPES:
                if isinstance(node.slice, ast.Tuple) and len(node.slice.elts) == 2:
                    return self._extract_class_from_annotation(node.slice.elts[1])
            return None
        return None

    @staticmethod
    def _is_self_attr(node):
        """Check if node is a self.xxx attribute access."""
        return (isinstance(node, ast.Attribute) and
                isinstance(node.value, ast.Name) and
                node.value.id == 'self')

    @staticmethod
    def _add_unique(lst, item):
        """Append item to list if not already present."""
        if item not in lst:
            lst.append(item)

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


class SequenceDiagramGenerator:
    """Generate @startuml/@enduml sequence diagrams from Python AST.

    Approach based on Fauzi et al. (2016) "Reverse engineering of source code
    to sequence diagram using AST" and Rountev et al. (2005) "Static
    control-flow analysis for reverse engineering of UML sequence diagrams":
      - Walk AST in execution order from the entry point
      - Map control-flow structures to UML 2.0 combined fragments
        (if/elif/else → alt, for/while → loop)
      - Track object creation, method calls, and self-calls
      - Recursively follow called method bodies to expose delegation chains
    """

    MAX_DEPTH = 3  # How deep to follow method calls

    def __init__(self, trees, all_class_names):
        self.trees = trees            # {filename: ast.Module}
        self.all_class_names = all_class_names

        # Lookup tables built once from all ASTs
        self.class_methods = {}       # {class_name: {method_name: ast.FunctionDef}}
        self.attr_types = {}          # {class_name: {attr_name: class_name}}
        self.param_types = {}         # {class_name: {method_name: {param: class_name}}}
        self._build_lookups()
        self._data_classes = self._identify_data_classes()

        # Output state (accumulated during generate())
        self.participants = []        # [(id, label)]
        self._participant_set = set()
        self.lines = []               # body lines of the diagram

        # Scope tracking
        self.var_types = {}           # {var_name: class_name} in current scope
        self._caller_class = {}       # {participant_id: class_name}

        # Recursion guard
        self._call_stack = set()      # (class_name, method_name) currently being followed

    # ── Build phase ──────────────────────────────────────────────────

    def _build_lookups(self):
        for _fn, tree in self.trees.items():
            for node in ast.walk(tree):
                if not isinstance(node, ast.ClassDef):
                    continue
                cname = node.name
                methods = {}
                a_types = {}
                p_types = {}
                for item in node.body:
                    if not isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        continue
                    methods[item.name] = item
                    # Parameter type hints → param_types
                    m_params = {}
                    for arg in item.args.args:
                        if arg.arg in ('self', 'cls'):
                            continue
                        if arg.annotation and isinstance(arg.annotation, ast.Name):
                            if arg.annotation.id in self.all_class_names:
                                m_params[arg.arg] = arg.annotation.id
                    if m_params:
                        p_types[item.name] = m_params
                    # __init__: self.x = ClassName() or self.x: T = ClassName() → attr_types
                    if item.name == '__init__':
                        for child in ast.walk(item):
                            if isinstance(child, ast.Assign):
                                for tgt in child.targets:
                                    if (isinstance(tgt, ast.Attribute)
                                            and isinstance(tgt.value, ast.Name)
                                            and tgt.value.id == 'self'
                                            and isinstance(child.value, ast.Call)):
                                        fn = child.value.func
                                        if isinstance(fn, ast.Name) and fn.id in self.all_class_names:
                                            a_types[tgt.attr] = fn.id
                            elif isinstance(child, ast.AnnAssign) and child.target:
                                if (isinstance(child.target, ast.Attribute)
                                        and isinstance(child.target.value, ast.Name)
                                        and child.target.value.id == 'self'):
                                    resolved = None
                                    if child.value and isinstance(child.value, ast.Call):
                                        fn = child.value.func
                                        if isinstance(fn, ast.Name) and fn.id in self.all_class_names:
                                            resolved = fn.id
                                    if not resolved and child.annotation:
                                        if isinstance(child.annotation, ast.Name) and child.annotation.id in self.all_class_names:
                                            resolved = child.annotation.id
                                    if resolved:
                                        a_types[child.target.attr] = resolved
                self.class_methods[cname] = methods
                self.attr_types[cname] = a_types
                self.param_types[cname] = p_types

    def _identify_data_classes(self):
        """Identify @dataclass-decorated and method-free classes (value objects).

        These are excluded from sequence diagrams since they don't represent
        collaborating actors — they're just data being passed around.
        """
        data = set()
        for _fn, tree in self.trees.items():
            for node in ast.walk(tree):
                if not isinstance(node, ast.ClassDef):
                    continue
                if node.name not in self.all_class_names:
                    continue
                # Check for @dataclass decorator
                for dec in node.decorator_list:
                    if isinstance(dec, ast.Name) and dec.id == 'dataclass':
                        data.add(node.name)
                        break
                    if (isinstance(dec, ast.Call) and isinstance(dec.func, ast.Name)
                            and dec.func.id == 'dataclass'):
                        data.add(node.name)
                        break
                    if isinstance(dec, ast.Attribute) and dec.attr == 'dataclass':
                        data.add(node.name)
                        break
                else:
                    # No dataclass decorator: check for behavioral methods
                    has_behavioral = False
                    for item in node.body:
                        if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                            if not (item.name.startswith('__') and item.name.endswith('__')):
                                has_behavioral = True
                                break
                    if not has_behavioral:
                        data.add(node.name)
        return data

    # ── Public entry point ───────────────────────────────────────────

    def generate(self):
        """Return the full @startuml … @enduml string, or '' if nothing to show."""
        entry = self._collect_entry_stmts()
        if not entry:
            return ''

        self._ensure_participant('Main', 'Main')
        self._process_stmts(entry, 'Main', depth=0)

        if not self.lines:
            return ''

        out = ['@startuml']
        for pid, plabel in self.participants:
            out.append('participant ' + pid + ': ' + plabel)
        out.append('')
        out.extend(self.lines)
        out.append('@enduml')
        return '\n'.join(out)

    # ── Entry-point collection ───────────────────────────────────────

    def _collect_entry_stmts(self):
        """Gather executable top-level statements (including __main__ blocks).

        Heuristic: if any file has a __main__ guard, use only the __main__
        block from the *last* file that has one (typically the driver/main script
        that imports the others).  If no file has __main__, fall back to all
        top-level executable statements.
        """
        # First pass: find __main__ blocks per file (preserving insertion order)
        main_blocks = {}   # {filename: [stmts]}
        top_stmts = []     # non-main top-level stmts across all files
        for fn, tree in self.trees.items():
            for node in tree.body:
                if isinstance(node, (ast.ClassDef, ast.FunctionDef,
                                     ast.AsyncFunctionDef,
                                     ast.Import, ast.ImportFrom)):
                    continue
                if isinstance(node, ast.If) and self._is_main_guard(node):
                    main_blocks.setdefault(fn, []).extend(node.body)
                else:
                    top_stmts.append(node)

        if main_blocks:
            # Use the last file's __main__ block
            last_fn = list(main_blocks.keys())[-1]
            return main_blocks[last_fn]
        return top_stmts

    @staticmethod
    def _is_main_guard(node):
        if not isinstance(node.test, ast.Compare):
            return False
        left = node.test.left
        if not (isinstance(left, ast.Name) and left.id == '__name__'):
            return False
        if len(node.test.comparators) != 1:
            return False
        comp = node.test.comparators[0]
        return isinstance(comp, ast.Constant) and comp.value == '__main__'

    # ── Statement processing ─────────────────────────────────────────

    def _process_stmts(self, stmts, caller, depth):
        for s in stmts:
            self._process_stmt(s, caller, depth)

    def _process_stmt(self, stmt, caller, depth):
        if isinstance(stmt, ast.Assign):
            self._process_assign(stmt, caller, depth)
        elif isinstance(stmt, ast.AnnAssign):
            if stmt.value:
                self._process_assign_value(stmt.value, [stmt.target], caller, depth)
        elif isinstance(stmt, ast.AugAssign):
            self._scan_expr_for_calls(stmt.value, caller, depth)
        elif isinstance(stmt, ast.Expr):
            self._process_expr_stmt(stmt, caller, depth)
        elif isinstance(stmt, ast.Return):
            if stmt.value:
                self._scan_expr_for_calls(stmt.value, caller, depth)
        elif isinstance(stmt, ast.If):
            if not self._is_main_guard(stmt):
                self._process_if(stmt, caller, depth)
            else:
                self._process_stmts(stmt.body, caller, depth)
        elif isinstance(stmt, ast.For):
            self._process_for(stmt, caller, depth)
        elif isinstance(stmt, ast.While):
            self._process_while(stmt, caller, depth)
        elif isinstance(stmt, ast.With):
            self._process_stmts(stmt.body, caller, depth)
        elif isinstance(stmt, ast.Try):
            self._process_try(stmt, caller, depth)

    # ── Assignments ──────────────────────────────────────────────────

    def _process_assign(self, stmt, caller, depth):
        self._process_assign_value(stmt.value, stmt.targets, caller, depth)

    def _process_assign_value(self, value, targets, caller, depth):
        """Handle var = ClassName(...) and general call detection in assignments."""
        if isinstance(value, ast.Call):
            resolved = self._resolve_call(value, caller)
            if resolved:
                cls_name, method = resolved
                if method == '__init__' and len(targets) == 1:
                    tgt = targets[0]
                    # var = ClassName(...) — local variable
                    if isinstance(tgt, ast.Name):
                        self.var_types[tgt.id] = cls_name
                        self._caller_class[tgt.id] = cls_name
                        if cls_name in self._data_classes:
                            return
                        self._ensure_participant(tgt.id, cls_name)
                        self.lines.append(caller + ' --> ' + tgt.id + ': <<create>>')
                        self._maybe_follow(cls_name, '__init__', tgt.id, depth)
                        return
                    # self.attr = ClassName(...) — attribute composition
                    if (isinstance(tgt, ast.Attribute)
                            and isinstance(tgt.value, ast.Name)
                            and tgt.value.id == 'self'):
                        if cls_name in self._data_classes:
                            return
                        pid = tgt.attr
                        self._ensure_participant(pid, cls_name)
                        self._caller_class[pid] = cls_name
                        self.lines.append(caller + ' --> ' + pid + ': <<create>>')
                        return
        # General: scan the whole value expression for calls
        self._scan_expr_for_calls(value, caller, depth)

    # ── Expression statements ────────────────────────────────────────

    def _process_expr_stmt(self, stmt, caller, depth):
        if isinstance(stmt.value, ast.Call):
            self._process_call(stmt.value, caller, depth)
        else:
            self._scan_expr_for_calls(stmt.value, caller, depth)

    # ── Control flow → combined fragments ────────────────────────────

    def _collect_fragment_lines(self, stmts, caller, depth):
        """Process statements into a temporary buffer; return only message lines."""
        snapshot = len(self.lines)
        self._process_stmts(stmts, caller, depth)
        new_lines = self.lines[snapshot:]
        del self.lines[snapshot:]
        return new_lines

    def _has_messages(self, fragment_lines):
        """True if any line is a real message (not just fragment markers)."""
        for ln in fragment_lines:
            stripped = ln.strip()
            if stripped and not stripped.startswith(('alt ', 'else ', 'loop ', 'opt ', 'end')):
                return True
        return False

    def _process_if(self, stmt, caller, depth):
        # Collect body + all branches first to see if any have messages
        branches = []
        cond = self._expr_text(stmt.test)
        body_lines = self._collect_fragment_lines(stmt.body, caller, depth)
        branches.append(('alt [' + cond + ']', body_lines))

        orelse = stmt.orelse
        while orelse:
            if len(orelse) == 1 and isinstance(orelse[0], ast.If):
                elif_node = orelse[0]
                elif_lines = self._collect_fragment_lines(elif_node.body, caller, depth)
                branches.append(('else [' + self._expr_text(elif_node.test) + ']', elif_lines))
                orelse = elif_node.orelse
            else:
                else_lines = self._collect_fragment_lines(orelse, caller, depth)
                branches.append(('else [else]', else_lines))
                break

        # Only emit if at least one branch produced messages
        if any(self._has_messages(bl) for _, bl in branches):
            for header, blines in branches:
                self.lines.append(header)
                self.lines.extend(blines)
            self.lines.append('end')
        else:
            # Still flush any nested calls that were collected (shouldn't happen
            # since we already processed them), but place them inline
            for _, blines in branches:
                self.lines.extend(blines)

    def _process_for(self, stmt, caller, depth):
        target = self._expr_text(stmt.target)
        iter_text = self._expr_text(stmt.iter)
        # Infer loop variable type from iter expression
        self._infer_loop_var_type(stmt, caller)
        body_lines = self._collect_fragment_lines(stmt.body, caller, depth)
        if self._has_messages(body_lines):
            self.lines.append('loop [for ' + target + ' in ' + iter_text + ']')
            self.lines.extend(body_lines)
            self.lines.append('end')
        else:
            self.lines.extend(body_lines)

    def _process_while(self, stmt, caller, depth):
        body_lines = self._collect_fragment_lines(stmt.body, caller, depth)
        if self._has_messages(body_lines):
            self.lines.append('loop [while ' + self._expr_text(stmt.test) + ']')
            self.lines.extend(body_lines)
            self.lines.append('end')
        else:
            self.lines.extend(body_lines)

    def _process_try(self, stmt, caller, depth):
        self._process_stmts(stmt.body, caller, depth)
        for handler in stmt.handlers:
            self._process_stmts(handler.body, caller, depth)

    # ── Call processing ──────────────────────────────────────────────

    def _process_call(self, call, caller, depth):
        """Process a single call node: emit a message and optionally follow the body."""
        # Scan arguments first (they execute before the call)
        for arg in call.args:
            self._scan_expr_for_calls(arg, caller, depth)
        for kw in call.keywords:
            self._scan_expr_for_calls(kw.value, caller, depth)

        resolved = self._resolve_call(call, caller)
        if not resolved:
            return
        cls_name, method = resolved

        # Skip data/value classes — they're not collaborating actors
        if cls_name in self._data_classes:
            return

        # Use attribute name as participant id for self.attr.method() calls
        attr_hint = None
        if (isinstance(call.func, ast.Attribute)
                and isinstance(call.func.value, ast.Attribute)
                and isinstance(call.func.value.value, ast.Name)
                and call.func.value.value.id == 'self'):
            attr_hint = call.func.value.attr
        callee_id = self._callee_id_for(cls_name, caller, attr_hint)

        if method == '__init__':
            self._ensure_participant(callee_id, cls_name)
            self._caller_class[callee_id] = cls_name
            self.lines.append(caller + ' --> ' + callee_id + ': <<create>>')
        elif callee_id == caller:
            # Self-call
            self.lines.append(caller + ' -> ' + caller + ': ' + method + '()')
            self._maybe_follow(cls_name, method, callee_id, depth)
        else:
            self._ensure_participant(callee_id, self._participant_label(callee_id, cls_name))
            self._caller_class[callee_id] = cls_name
            self.lines.append(caller + ' -> ' + callee_id + ': ' + method + '()')
            self._maybe_follow(cls_name, method, callee_id, depth)

    def _maybe_follow(self, cls_name, method_name, callee_id, depth):
        """Recursively follow into the called method body."""
        if depth >= self.MAX_DEPTH:
            return
        key = (cls_name, method_name)
        if key in self._call_stack:
            return
        meths = self.class_methods.get(cls_name)
        if not meths or method_name not in meths:
            return
        node = meths[method_name]
        self._call_stack.add(key)
        saved = self.var_types.copy()
        # Seed local scope with parameter type hints
        self.var_types = {}
        pt = self.param_types.get(cls_name, {}).get(method_name, {})
        self.var_types.update(pt)
        self._process_stmts(node.body, callee_id, depth + 1)
        self.var_types = saved
        self._call_stack.discard(key)

    # ── Call resolution ──────────────────────────────────────────────

    def _resolve_call(self, call, caller):
        """Return (class_name, method_name) or None."""
        func = call.func

        # ClassName(...)
        if isinstance(func, ast.Name) and func.id in self.all_class_names:
            return (func.id, '__init__')

        # var.method()
        if isinstance(func, ast.Attribute) and isinstance(func.value, ast.Name):
            var = func.value.id
            method = func.attr
            if var == 'self':
                cc = self._class_of(caller)
                if cc:
                    return (cc, method)
            elif var in self.var_types:
                return (self.var_types[var], method)
            return None

        # self.attr.method()
        if (isinstance(func, ast.Attribute)
                and isinstance(func.value, ast.Attribute)
                and isinstance(func.value.value, ast.Name)
                and func.value.value.id == 'self'):
            attr = func.value.attr
            method = func.attr
            cc = self._class_of(caller)
            if cc and cc in self.attr_types and attr in self.attr_types[cc]:
                return (self.attr_types[cc][attr], method)

        return None

    # ── Scan nested calls in arbitrary expressions ───────────────────

    def _scan_expr_for_calls(self, node, caller, depth):
        """Walk an expression tree and process every Call node found."""
        if node is None:
            return
        if isinstance(node, ast.Call):
            self._process_call(node, caller, depth)
            return  # _process_call already scans args
        for child in ast.iter_child_nodes(node):
            self._scan_expr_for_calls(child, caller, depth)

    # ── Loop variable type inference ─────────────────────────────────

    def _infer_loop_var_type(self, for_node, caller):
        """Try to infer the type of the loop variable from the iterable."""
        if not isinstance(for_node.target, ast.Name):
            return
        var = for_node.target.id
        it = for_node.iter
        # for x in self.things  →  check attr_types for 'things'
        if (isinstance(it, ast.Attribute)
                and isinstance(it.value, ast.Name)
                and it.value.id == 'self'):
            attr = it.attr
            cc = self._class_of(caller)
            if cc:
                # Look for add_* methods that take a typed parameter
                meths = self.class_methods.get(cc, {})
                for mname, mnode in meths.items():
                    for arg in mnode.args.args:
                        if arg.arg in ('self', 'cls'):
                            continue
                        if arg.annotation and isinstance(arg.annotation, ast.Name):
                            if arg.annotation.id in self.all_class_names:
                                # Check if this method appends to the same attr
                                if self._method_appends_to(mnode, attr):
                                    self.var_types[var] = arg.annotation.id
                                    return
        # for x in var  →  check var_types
        if isinstance(it, ast.Name) and it.id in self.var_types:
            pass  # can't infer element type from container type alone

    @staticmethod
    def _method_appends_to(func_node, attr_name):
        """Check if a method body contains self.<attr_name>.append(...)."""
        for child in ast.walk(func_node):
            if (isinstance(child, ast.Call)
                    and isinstance(child.func, ast.Attribute)
                    and child.func.attr == 'append'
                    and isinstance(child.func.value, ast.Attribute)
                    and isinstance(child.func.value.value, ast.Name)
                    and child.func.value.value.id == 'self'
                    and child.func.value.attr == attr_name):
                return True
        return False

    # ── Helpers ──────────────────────────────────────────────────────

    def _ensure_participant(self, pid, label):
        if pid not in self._participant_set:
            self._participant_set.add(pid)
            self.participants.append((pid, label))

    def _callee_id_for(self, cls_name, caller, attr_hint=None):
        """Find the best participant id for a class: prefer attr name or existing variable."""
        if attr_hint:
            return attr_hint
        for v, c in self.var_types.items():
            if c == cls_name:
                return v
        # Check existing participants
        for pid, _lbl in self.participants:
            if self._caller_class.get(pid) == cls_name and pid != 'Main':
                return pid
        return cls_name

    def _participant_label(self, pid, cls_name):
        """Return class name — renderer prepends 'id: ' when id != label."""
        return cls_name

    def _class_of(self, participant_id):
        """Return the class name associated with a participant."""
        if participant_id in self._caller_class:
            return self._caller_class[participant_id]
        if participant_id in self.all_class_names:
            return participant_id
        return None

    @staticmethod
    def _expr_text(node):
        """Best-effort readable text for an AST expression."""
        try:
            return ast.unparse(node)
        except Exception:
            return '...'


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
    """Generate UML class diagram text in custom format for the SVG renderer.

    Emits five relationship types based on static analysis heuristics:
    - Inheritance (--|>): from class bases
    - Composition (*--): field holds object created internally
    - Aggregation (o--): field holds object injected from outside
    - Association (-->): field references a class without clear ownership
    - Dependency (..>): method parameter/return/local usage of a class
    """
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

        # Attributes — filter out those promoted to relationships
        for attr_name, type_hint in cls.attributes:
            if attr_name in cls._rel_attrs:
                continue  # shown as relationship arrow instead
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
        # Inheritance
        for base in cls.bases:
            if base in ('ABC', 'ABCMeta'):
                continue
            if any(c.name == base for c in all_classes):
                lines.append(cls.name + ' --|> ' + base)
        # Composition (strong ownership — filled diamond)
        for comp in cls.compositions:
            lines.append(cls.name + ' *-- ' + comp)
        # Aggregation (weak ownership — hollow diamond)
        for agg in cls.aggregations:
            lines.append(cls.name + ' o-- ' + agg)
        # Association (navigable reference — solid arrow)
        for assoc in cls.associations:
            lines.append(cls.name + ' --> ' + assoc)
        # Dependency (transient usage — dashed arrow)
        for dep in cls.dependencies:
            lines.append(cls.name + ' ..> ' + dep)

    lines.append('@enduml')
    return '\n'.join(lines)




def generate_sequence_diagram(trees, all_class_names):
    """Generate @startuml/@enduml sequence diagram using AST-based static analysis.

    Uses SequenceDiagramGenerator which walks the AST in execution order,
    maps control-flow to combined fragments, and follows method bodies.
    """
    gen = SequenceDiagramGenerator(trees, all_class_names)
    return gen.generate()


def analyze(sources):
    """
    Analyze Python sources and return diagram syntax.

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

    class_diagram = generate_class_diagram(all_classes) if all_classes else ''
    sequence_diagram = generate_sequence_diagram(trees, all_class_names) if all_classes else ''

    return {
        'classDiagram': class_diagram,
        'sequenceDiagram': sequence_diagram,
        'errors': errors,
    }


# Entry point: read __uml_sources global set by the JS bridge
if '__uml_sources' in dir():
    result = analyze(__uml_sources)
