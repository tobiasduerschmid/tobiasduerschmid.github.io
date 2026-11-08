/** Compiler-independent C++ source instrumentation; Clang still owns all evaluation. */
export const CPP_SOURCE_LIMIT = 16000;
export const CPP_OUTPUT_LIMIT = 2 * 1024 * 1024;
const HEADER_NAMES = new Set(['iostream', 'string']);

// Mask comments and quoted tokens before recognizing directives. Reject literals
// that cannot safely receive the per-line source mappings used after expansion.
function directiveSource(code) {
  const masked = code.split('');
  const hide = (start, end) => {
    for (let index = start; index < end; index++) if (code[index] !== '\n') masked[index] = ' ';
  };
  for (let index = 0; index < code.length;) {
    const start = index;
    if (code.startsWith('//', index)) {
      index = code.indexOf('\n', index + 2);
      if (index < 0) index = code.length;
      // Translation phase two splices escaped newlines before recognizing comments.
      while (index < code.length && code[index - 1] === '\\') {
        index = code.indexOf('\n', index + 1);
        if (index < 0) index = code.length;
      }
      hide(start, index); continue;
    }
    if (code.startsWith('/*', index)) {
      const end = code.indexOf('*/', index + 2);
      index = end < 0 ? code.length : end + 2;
      hide(start, index); continue;
    }
    if (/^(?:u8|u|U|L)?R"/.test(code.slice(index))) {
      throw new Error('Raw string literals are not supported in this lab; use ordinary quoted strings with \\n escapes.');
    }
    // Consume preprocessing-number tokens, leaving validity and numeric meaning
    // to Clang. Apostrophes inside them are separators, not character quotes.
    const number = /^(?:[0-9]|\.[0-9])(?:[eEpP][+-]|[A-Za-z_0-9.]|'[A-Za-z_0-9])*/.exec(code.slice(index));
    if (number) { index += number[0].length; continue; }
    const quote = code[index];
    if (quote === '"' || quote === "'") {
      index++;
      while (index < code.length && code[index] !== quote) {
        if (code[index] === '\n' || (code[index] === '\\' && /[\r\n]/.test(code[index + 1] || ''))) {
          throw new Error('Multiline quoted literals are not supported in this lab; use \\n escapes.');
        }
        index += code[index] === '\\' ? 2 : 1;
      }
      if (index < code.length) index++;
      hide(start, index); continue;
    }
    const identifier = /^[A-Za-z_][A-Za-z_0-9]*/.exec(code.slice(index));
    if (identifier) { index += identifier[0].length; continue; }
    index++;
  }
  return masked.join('');
}

export function preprocessingSource(code) {
  if (typeof code !== 'string' || !code.trim()) throw new Error('Enter a complete C++17 program with main().');
  if (code.length > CPP_SOURCE_LIMIT) throw new Error('C++ lab source limit is 16,000 characters.');
  if (/\b__ort\w*/.test(code)) throw new Error('Names beginning __ort are reserved by the C++ observer.');
  const directives = directiveSource(code).split('\n');
  return code.split('\n').map((line, index) => {
    const directive = directives[index];
    const include = /^\s*#\s*include\s*<([^>]+)>\s*$/.exec(directive);
    if (include) {
      if (!HEADER_NAMES.has(include[1])) throw new Error(`Line ${index + 1}: this lab supports only <iostream> and <string> headers.`);
      return '';
    }
    if (/^\s*#/.test(directive) && !/^\s*#\s*(define|undef)\b/.test(directive)) {
      throw new Error(`Line ${index + 1}: only #include, #define and #undef directives are supported.`);
    }
    return line;
  }).join('\n');
}

/** Strip Clang line markers while retaining each expanded line's original source line. */
export function mappedPreprocessedSource(text) {
  if (text.length > 64000) throw new Error('Macro expansion exceeds the 64,000-character lab limit.');
  let line = 1;
  let inSource = false;
  const lines = [], origins = [];
  for (const value of text.split('\n')) {
    const marker = /^#\s+(\d+)\s+"([^"]+)"/.exec(value);
    if (marker) { line = Number(marker[1]); inSource = marker[2].endsWith('/input.cpp') || marker[2] === 'input.cpp'; continue; }
    if (inSource) { lines.push(value); origins.push(line); }
    line++;
  }
  return { code: lines.join('\n'), origins };
}

function fail(node, origins, message) {
  throw new Error(`Line ${origins[node.startPosition.row] || 1}: ${message}`);
}
function declaratorInfo(node, origins) {
  let current = node, reference = false, pointer = false;
  while (current && current.type !== 'identifier') {
    if (current.type === 'reference_declarator') {
      if (reference || current.text.includes('&&')) fail(node, origins, 'Rvalue references are not supported in this lab.');
      reference = true;
    } else if (current.type === 'pointer_declarator') {
      if (pointer) fail(node, origins, 'Multiple pointer indirection is not supported in this lab.');
      pointer = true;
    } else fail(node, origins, 'Use a simple named scalar, string, reference, or pointer declaration.');
    current = current.childForFieldName('declarator') || current.namedChildren.find(child => child.type !== 'type_qualifier');
  }
  if (!current || (pointer && reference)) fail(node, origins, 'References to pointers are not supported in this lab.');
  return { name: current.text, semantics: pointer ? 'object-reference' : reference ? 'reference' : 'value' };
}

/** Accept a parsed syntax subset, then insert observations only at full-expression boundaries. */
export function instrumentCpp({ code, origins }, parser) {
  const tree = parser.parse(code);
  const edits = [];
  let counter = 0;
  const lineOf = node => origins[node.startPosition.row] || 1;
  const insert = (position, text) => edits.push({ position, text, order: edits.length });
  const snapshot = (node, event = 'line') => `__ort::snapshot(${lineOf(node)},"${event}");`;
  const observe = (declarator, type) => {
    const info = declaratorInfo(declarator, origins);
    return `__ort::Watch<decltype(${info.name})> __ort_w${counter++}(${JSON.stringify(info.name)},${info.name},${JSON.stringify(info.semantics)},${JSON.stringify(type)});`;
  };
  const validateExpression = node => {
    const forbidden = new Set(['lambda_expression', 'new_expression', 'delete_expression', 'declaration', 'init_statement', 'compound_literal_expression', 'statement_expression', 'subscript_expression', 'cast_expression', 'co_await_expression']);
    if (forbidden.has(node.type) || node.type.endsWith('_cast_expression')) fail(node, origins, `${node.type.replaceAll('_', ' ')} is not supported in this lab.`);
    for (const child of node.namedChildren) validateExpression(child);
  };
  const declaration = node => {
    const typeNode = node.childForFieldName('type');
    const type = typeNode?.text;
    if (!['primitive_type', 'sized_type_specifier'].includes(typeNode?.type) && !/^(std::string|string|auto)$/.test(type || '')) {
      fail(node, origins, 'Only scalar and std::string variables are supported; arrays, classes and containers are not visualized.');
    }
    if (node.namedChildren.some(child => child.type === 'storage_class_specifier' || (child.type === 'type_qualifier' && child.text !== 'const'))) {
      fail(node, origins, 'Static, extern, thread-local and volatile storage are not supported.');
    }
    const declarations = node.childrenForFieldName('declarator');
    if (declarations.length > 1) fail(node, origins, 'Multiple declarators are not supported in this lab; put each variable in its own declaration statement.');
    let text = '';
    for (const value of declarations) {
      const actual = value.type === 'init_declarator' ? value.childForFieldName('declarator') : value;
      if (value.type !== 'init_declarator' && !/^(std::)?string$/.test(type)) fail(value, origins, 'Initialize every scalar and pointer before it can be observed.');
      validateExpression(value);
      text += observe(actual, type);
    }
    if (!declarations.length) fail(node, origins, 'This declaration cannot be visualized.');
    insert(node.endIndex, text + snapshot(node));
  };
  const block = (node, functionBody = false) => {
    if (!functionBody) insert(node.startIndex + 1, `__ort::Block __ort_b${counter++}(${lineOf(node)});`);
    for (const child of node.namedChildren) statement(child);
    insert(node.endIndex - 1, `__ort::snapshot(${origins[node.endPosition.row] || lineOf(node)},"${functionBody ? 'return' : 'line'}");`);
  };
  const controlledBlock = node => {
    if (node?.type !== 'compound_statement') fail(node, origins, 'Put if/else and while bodies inside braces in this lab.');
    block(node);
  };
  const statement = node => {
    if (node.type === 'comment') return;
    if (node.type === 'declaration') return declaration(node);
    if (node.type === 'compound_statement') return block(node);
    if (node.type === 'expression_statement') { validateExpression(node); insert(node.endIndex, snapshot(node)); return; }
    if (node.type === 'return_statement') { validateExpression(node); insert(node.startIndex, snapshot(node, 'return')); return; }
    if (node.type === 'do_statement') {
      const condition = node.childForFieldName('condition');
      validateExpression(condition);
      insert(condition.startIndex + 1, '__ort::tick(),('); insert(condition.endIndex - 1, ')');
      controlledBlock(node.childForFieldName('body'));
      insert(node.endIndex, snapshot(node)); return;
    }
    if (node.type === 'if_statement' || node.type === 'while_statement') {
      const condition = node.childForFieldName('condition');
      if (condition.namedChildren.some(child => child.type === 'declaration')) fail(condition, origins, 'Declare condition variables before the if/while.');
      validateExpression(condition);
      // The comma expression preserves condition evaluation exactly once and bounds empty loops.
      const value = condition.childForFieldName('value');
      if (!value) fail(condition, origins, 'Use an ordinary expression condition.');
      insert(value.startIndex, '(__ort::tick(),('); insert(value.endIndex, '))');
      controlledBlock(node.childForFieldName(node.type === 'if_statement' ? 'consequence' : 'body'));
      const alternative = node.childForFieldName('alternative');
      if (alternative) controlledBlock(alternative.type === 'else_clause' ? alternative.namedChildren[0] : alternative);
      insert(node.endIndex, snapshot(node)); return;
    }
    if (node.type === 'using_declaration' && /^using\s+(namespace\s+std|std::(?:string|cout|endl))\s*;$/.test(node.text)) return;
    fail(node, origins, `${node.type.replaceAll('_', ' ')} is not supported in this lab; use simple functions, declarations, expressions, braced if/while, and return.`);
  };
  try {
    if (tree.rootNode.hasError) fail(tree.rootNode.descendantsOfType('ERROR')[0] || tree.rootNode, origins, 'C++ syntax could not be instrumented; check the declaration or statement.');
    let hasMain = false;
    for (const node of tree.rootNode.namedChildren) {
      if (node.type === 'comment' || node.type === 'using_declaration') { statement(node); continue; }
      if (node.type !== 'function_definition') fail(node, origins, 'This lab requires function definitions; global variables, classes, templates and prototypes are unsupported.');
      const fn = node.childForFieldName('declarator');
      if (fn?.type !== 'function_declarator' || fn.childForFieldName('declarator')?.type !== 'identifier') fail(node, origins, 'Use ordinary free functions with named parameters.');
      const name = fn.childForFieldName('declarator').text;
      hasMain ||= name === 'main';
      const body = node.childForFieldName('body');
      let entry = `__ort::Frame __ort_f${counter++}(${JSON.stringify(name)});`;
      for (const parameter of fn.childForFieldName('parameters').namedChildren) {
        if (parameter.type !== 'parameter_declaration') fail(parameter, origins, 'Default, variadic and unnamed parameters are unsupported.');
        const decl = parameter.childForFieldName('declarator');
        if (!decl) fail(parameter, origins, 'Give every parameter a name.');
        entry += observe(decl, parameter.childForFieldName('type').text);
      }
      insert(body.startIndex + 1, entry + snapshot(node, 'call'));
      block(body, true);
    }
    if (!hasMain) throw new Error('The C++ lab needs int main().');
    // Insertion order at a shared boundary matters: close the previous statement before opening the next.
    edits.sort((a, b) => b.position - a.position || b.order - a.order);
    let instrumented = code;
    for (const edit of edits) instrumented = instrumented.slice(0, edit.position) + edit.text + instrumented.slice(edit.position);
    // Compiler diagnostics refer to original lines even after preprocessing expansion.
    return '#include "object-reference-cpp-runtime.hpp"\n' + instrumented.split('\n').map((line, index) => `#line ${origins[index] || 1} "input.cpp"\n${line}`).join('\n');
  } finally { tree.delete(); }
}

export function decodeCppTrace(stderr, stdout = '', exitCode = 0) {
  const steps = [];
  let error = null, truncated = false, complete = false, finalOutput;
  for (const line of stderr.split('\n')) {
    if (!line.startsWith('__ORT__')) continue;
    const record = JSON.parse(line.slice(7));
    if (record.step) steps.push(record.step);
    if (record.end) { complete = true; error = record.error || null; truncated = !!record.truncated; finalOutput = record.output; }
  }
  if (!complete) error = `C++ execution did not finish${exitCode ? ` (exit ${exitCode})` : ''}.`;
  if (exitCode && !error) error = `C++ program exited with status ${exitCode}.`;
  if (stdout) error = error || 'Unsupported direct output: use std::cout in this lab.';
  const last = steps.at(-1);
  if (error && last) steps.push({ ...last, event: 'error', note: error });
  else if (complete && !error) steps.push({ event: 'final', line: 0,
    visualizedLine: last?.visualizedLine || 0, scopes: [], objects: [], output: finalOutput ?? last?.output ?? '' });
  return { steps, error, truncated };
}
