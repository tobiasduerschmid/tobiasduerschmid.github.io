/** Inspect only generated source, without executing it or reading hidden tests.
 * Python's scope analysis handles parameters, closures, aliases, and builtins.
 * This catches unresolved global names, not all possible runtime errors.
 */
export function inspectionProgram(source) {
  const payload = JSON.stringify(JSON.stringify(source));
  return `import ast as _llm_ast, builtins as _llm_builtins, json as _llm_json
import symtable as _llm_symtable, sys as _llm_sys

def _llm_inspect():
    source = _llm_json.loads(${payload})
    try:
        compile(source, '<generated-program>', 'exec')
        tree = _llm_ast.parse(source)
        root = _llm_symtable.symtable(source, '<generated-program>', 'exec')
    except (SyntaxError, ValueError):
        return {'status': 'syntax'}
    tables, pending = [], [root]
    while pending:
        table = pending.pop()
        tables.append(table)
        pending.extend(table.get_children())
    available = set(dir(_llm_builtins)) | {'__name__', '__doc__', '__package__', '__builtins__'}
    for table in tables:
        for symbol in table.get_symbols():
            if (table is root or symbol.is_global()) and (symbol.is_assigned() or symbol.is_imported()):
                available.add(symbol.get_name())
    missing = sorted({symbol.get_name() for table in tables for symbol in table.get_symbols()
        if symbol.is_referenced() and symbol.is_global() and symbol.get_name() not in available})
    external = set()
    standard = _llm_sys.stdlib_module_names | set(_llm_sys.builtin_module_names)
    for node in _llm_ast.walk(tree):
        if isinstance(node, _llm_ast.Import):
            external.update(alias.name for alias in node.names if alias.name.split('.')[0] not in standard)
        elif isinstance(node, _llm_ast.ImportFrom):
            if node.level or (node.module or '').split('.')[0] not in standard:
                external.add('.' * node.level + (node.module or ''))
    if missing or external:
        return {'status': 'incomplete', 'missingNames': missing, 'externalImports': sorted(external)}
    return {'status': 'complete'}
print(_llm_json.dumps(_llm_inspect()))
`;
}
