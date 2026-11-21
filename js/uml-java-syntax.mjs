// Keep the Tree-sitter trees on the worker that owns them. Snapshots returned
// to the diagram generator contain plain declarations and UTF-16 source ranges.
const grammar = new URL('./vendor/tree-sitter/tree-sitter-java-0.23.5/tree-sitter-java.wasm', import.meta.url);
const child = (node, name) => node?.childForFieldName(name);
const text = (node, name) => child(node, name)?.text || '';
const named = (node, type) => node?.namedChildren.filter(n => n.type === type) || [];

function typeText(node) {
  return node?.text.replace(/\s*([<>,.[\]])\s*/g, '$1').trim() || '';
}

function modifiers(node) {
  return named(node, 'modifiers')[0]?.children.filter(n => !n.isNamed).map(n => n.type) || [];
}

function parameters(node) {
  return (node?.namedChildren || []).flatMap(param => {
    if (param.type === 'formal_parameter') {
      return [{ name: text(param, 'name'), type: typeText(child(param, 'type')) + typeText(child(param, 'dimensions')) }];
    }
    if (param.type === 'spread_parameter') {
      const type = param.namedChildren.find(n => n.type !== 'modifiers' && n.type !== 'variable_declarator');
      return [{ name: text(named(param, 'variable_declarator')[0], 'name'), type: typeText(type) + '...' }];
    }
    return [];
  });
}

const kinds = new Map([['class_declaration', 'class'], ['interface_declaration', 'interface'],
  ['enum_declaration', 'enum'], ['record_declaration', 'class']]);

function declaration(node) {
  const kind = kinds.get(node.type), name = text(node, 'name');
  if (!kind || !name) return null;
  const body = child(node, 'body');
  const components = parameters(child(node, 'parameters'));
  const members = [];
  const constants = [];
  function visit(member) {
    if (kinds.has(member.type)) {
      const nested = declaration(member);
      if (nested) members.push(nested);
    } else if (member.type === 'enum_constant') {
      constants.push(text(member, 'name'));
    } else if (member.type === 'enum_body_declarations') {
      member.namedChildren.forEach(visit);
    } else if (['field_declaration', 'constant_declaration'].includes(member.type)) {
      const type = typeText(child(member, 'type'));
      for (const variable of named(member, 'variable_declarator')) {
        const value = child(variable, 'value');
        const constructed = value?.type === 'object_creation_expression';
        members.push({
          kind: 'field', name: text(variable, 'name'), range: [member.startIndex, member.endIndex],
          type: type + typeText(child(variable, 'dimensions')), modifiers: modifiers(member),
          initHasNew: constructed, initNewType: constructed ? typeText(child(value, 'type')) : ''
        });
      }
    } else if (['method_declaration', 'constructor_declaration', 'compact_constructor_declaration'].includes(member.type)) {
      const block = child(member, 'body');
      const parameterList = child(member, 'parameters');
      const method = {
        kind: member.type === 'method_declaration' ? 'method' : 'constructor',
        name: text(member, 'name'), nameStart: child(member, 'name')?.startIndex,
        range: [member.startIndex, member.endIndex],
        returnType: typeText(child(member, 'type')) + typeText(child(member, 'dimensions')),
        modifiers: modifiers(member), params: parameterList ? parameters(parameterList) : components,
        throwsTypes: named(member, 'throws')[0]?.namedChildren.map(typeText) || []
      };
      if (block) {
        const end = block.lastChild?.type === '}' ? block.lastChild.startIndex : block.endIndex;
        method.bodyRange = [block.startIndex + 1, end];
      }
      members.push(method);
    }
  }
  body?.namedChildren.forEach(visit);
  const interfaces = container => named(container, 'type_list')[0]?.namedChildren.map(typeText) || [];
  const superclass = child(node, 'superclass')?.firstNamedChild;
  return {
    kind, name, nameStart: child(node, 'name')?.startIndex, members, modifiers: modifiers(node), constants,
    range: [node.startIndex, node.endIndex],
    recordComponents: node.type === 'record_declaration' ? components : null,
    extends: kind === 'interface' ? interfaces(named(node, 'extends_interfaces')[0]) : typeText(superclass),
    implements: interfaces(child(node, 'interfaces'))
  };
}

function position(source, index) {
  const prefix = source.slice(0, index);
  return {row: prefix.split('\n').length - 1, column: index - prefix.lastIndexOf('\n') - 1};
}

function editTree(tree, before, after) {
  let start = 0, oldEnd = before.length, newEnd = after.length;
  while (start < oldEnd && start < newEnd && before.charCodeAt(start) === after.charCodeAt(start)) start++;
  while (oldEnd > start && newEnd > start && before.charCodeAt(oldEnd - 1) === after.charCodeAt(newEnd - 1)) {
    oldEnd--; newEnd--;
  }
  tree.edit({
    startIndex: start, oldEndIndex: oldEnd, newEndIndex: newEnd,
    startPosition: position(before, start),
    oldEndPosition: position(before, oldEnd), newEndPosition: position(after, newEnd)
  });
}

export async function createJavaSyntaxWorkspace() {
  const { Parser, Language } = await import('./vendor/tree-sitter/web-tree-sitter-0.25.10/tree-sitter.js');
  await Parser.init();
  const language = await Language.load(grammar.href);
  const parser = new Parser();
  parser.setLanguage(language);
  return javaSyntaxWorkspace(parser);
}

export function javaSyntaxWorkspace(parser) {
  const files = new Map();
  function remove(path) {
    files.get(path)?.tree.delete();
    files.delete(path);
  }
  return {
    parse(sources) {
      for (const path of files.keys()) if (!Object.hasOwn(sources, path)) remove(path);
      const declarations = new Map();
      for (const [path, source] of Object.entries(sources)) {
        let file = files.get(path);
        if (file?.source !== source) {
          // Once edited, the prior tree is no longer a valid old snapshot, even
          // if parsing or projection fails. Drop it before allowing a retry.
          let tree;
          try {
            if (file) editTree(file.tree, file.source, source);
            tree = parser.parse(source, file?.tree);
            const nodes = tree.rootNode.namedChildren;
            // An unfinished header can absorb a whole type into a top-level
            // ERROR. Recover that file's current declarations with the tolerant
            // token parser until the grammar can identify its boundaries again.
            const ast = nodes.some(n => n.type === 'ERROR') ? null : nodes.map(declaration).filter(Boolean);
            file = {source, tree, ast};
          } catch (error) {
            tree?.delete();
            throw error;
          } finally {
            remove(path);
          }
          files.set(path, file);
        }
        if (file.ast) declarations.set(path, file.ast);
      }
      return declarations;
    },
    dispose() {
      for (const path of files.keys()) remove(path);
      parser.delete();
    }
  };
}
