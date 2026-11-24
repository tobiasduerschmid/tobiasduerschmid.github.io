// Monaco-facing Java services use ECJ's UTF-16 ranges and resolved binding keys.
// A rename is speculative until a second compilation confirms symbol identities.
const identifier = /^[$_\p{ID_Start}][$_\p{ID_Continue}]*$/u;
const reserved = new Set(('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null').split(' '));

function snapshot(host) {
  const models = new Map();
  const files = Object.create(null);
  for (const [path, entry] of Object.entries(host.getModels())) {
    const model = entry.model || entry;
    if (!path.endsWith('.java') || model.isDisposed()) continue;
    models.set(path, { model, version: model.getVersionId() });
    files[path] = model.getValue();
  }
  return { models, files };
}

function fresh(host, state, token) {
  if (token?.isCancellationRequested) return false;
  const current = host.getModels();
  return Object.keys(current).filter(k => k.endsWith('.java')).length === state.models.size &&
    [...state.models].every(([path, { model, version }]) =>
      (current[path]?.model || current[path]) === model && !model.isDisposed() && model.getVersionId() === version);
}

function modelRange(model, item) {
  const start = model.getPositionAt(item.start), end = model.getPositionAt(item.end);
  return {startLineNumber:start.lineNumber, startColumn:start.column, endLineNumber:end.lineNumber, endColumn:end.column};
}

function symbolAt(symbols, file, offset) {
  return symbols.find(s => s.file === file && s.start <= offset && offset < s.end) ||
    symbols.find(s => s.file === file && s.end === offset);
}

function related(symbols, target) {
  const keys = new Set([target.key]);
  const family = symbols.filter(s => s.declaration && s.kind === 'method' && s.name === target.name);
  let previous;
  do {
    previous = keys.size;
    for (const s of family) {
      const linked = [s.key, ...(s.overrides || [])];
      if (linked.some(k => keys.has(k))) linked.forEach(k => keys.add(k));
    }
  } while (keys.size !== previous);
  return keys;
}

function renameProblem(symbols, target) {
  if (!target) return 'Select a resolved Java declaration or reference.';
  if (target.kind === 'type' || target.constructor === true) return 'Type and constructor renames also need file and import changes. Select a field, local variable, or method.';
  const keys = related(symbols, target);
  const local = new Set(symbols.filter(s => s.declaration).map(s => s.key));
  if ([...keys].some(key => !local.has(key))) return 'This declaration or an overridden method belongs to an external library.';
  return '';
}

function hasErrors(analysis) { return analysis.diagnostics?.some(d => d.severity === 'error'); }

export async function renamePlan(files, original, target, name, analyze) {
  const symbols = original.bindings;
  const reject = rejectReason => ({ rejectReason, edits: [] });
  const problem = renameProblem(symbols, target);
  if (problem) return reject(problem);
  if (!identifier.test(name) || reserved.has(name)) return reject('Enter a Java identifier.');
  if (name === target.name) return { edits: [] };
  if (hasErrors(original)) return reject('Resolve the Java compiler errors before renaming.');
  const keys = related(symbols, target);
  const edits = symbols.filter(s => keys.has(s.key));
  const grouped = new Map();
  for (const s of edits) {
    if (!grouped.has(s.file)) grouped.set(s.file, []);
    grouped.get(s.file).push(s);
  }
  const next = {...files};
  for (const [file, changes] of grouped) {
    changes.sort((a,b) => a.start - b.start);
    for (const s of changes.slice().reverse()) next[file] = next[file].slice(0,s.start) + name + next[file].slice(s.end);
  }
  const updated = await analyze(next);
  if (hasErrors(updated)) return reject('This rename would introduce a Java compilation error.');
  const byLocation = new Map(updated.bindings.map(s => [s.file + ':' + s.start + ':' + s.kind, s]));
  const newSymbol = s => {
    let at = s.start;
    for (const e of grouped.get(s.file) || []) {
      if (e.start >= s.start) break;
      at += name.length - (e.end - e.start);
    }
    return byLocation.get(s.file + ':' + at + ':' + s.kind);
  };
  // Track declaration identity even when ECJ's keys for parameters/locals change
  // because their enclosing method was renamed.
  const mappedKeys = new Map();
  for (const s of symbols.filter(s => s.declaration)) {
    const cur = newSymbol(s);
    if (!cur?.declaration) return reject('A declaration could no longer be resolved.');
    mappedKeys.set(s.key, cur.key);
  }
  if (new Set(mappedKeys.values()).size !== mappedKeys.size) return reject('Two declarations would resolve to the same symbol.');
  for (const s of symbols) {
    const cur = newSymbol(s);
    if (!cur || cur.key !== (mappedKeys.get(s.key) || s.key) || cur.name !== (keys.has(s.key) ? name : s.name))
      return reject('This rename would change which declaration a reference uses.');
    if (s.overrides) {
      const expected = s.overrides.map(k => mappedKeys.get(k) || k);
      if (cur.overrides?.length !== expected.length || expected.some(k => !cur.overrides.includes(k)))
        return reject('This rename would change a method override.');
    }
  }
  return { edits };
}

function supertypes(type, declarations) {
  const all = new Set();
  const todo = type ? [type.replace(/<.*>$/, '')] : [];
  while (todo.length) {
    const name = todo.pop();
    if (all.has(name)) continue;
    all.add(name);
    const definition = declarations.find(symbol => symbol.kind === 'type' && symbol.type === name);
    if (definition?.parents) todo.push(...definition.parents);
  }
  return all;
}

function memberCompletions(context, receiver, offset) {
  const declarations = context.symbols.filter(symbol => symbol.declaration);
  const enclosing = declarations.filter(symbol => symbol.kind === 'type' && symbol.file === context.file &&
    symbol.scopeStart <= offset && offset < symbol.scopeEnd).sort((left,right) => right.scopeStart-left.scopeStart)[0];
  const available = symbol => symbol.access === 'public' || (symbol.access === 'private'
    ? enclosing?.nest === symbol.nest : enclosing?.package === symbol.package);
  if (!receiver) return declarations.filter(symbol => symbol.kind === 'type' && available(symbol));

  const ref = symbolAt(context.symbols,context.file,receiver.index);
  const sourceName = receiver[1];
  // ECJ can omit an incomplete member expression while the learner is typing.
  // Use a recovered declaration only when the receiver's possible types agree.
  const candidates = declarations.filter(s => s.name === sourceName && (s.file === context.file || s.kind === 'type'));
  const types = new Set(candidates.map(s => s.type));
  const receiverType = sourceName === 'this' ? enclosing?.type : ref?.type || (types.size === 1 ? [...types][0] : null);
  const owners = supertypes(receiverType,declarations);
  const enclosingBases = supertypes(enclosing?.type,declarations);
  return declarations.filter(symbol => {
    if (!['method','field'].includes(symbol.kind) || !owners.has(symbol.owner) || symbol.constructor === true) return false;
    if (ref?.kind === 'type' && !symbol.static) return false;
    return available(symbol) || symbol.access === 'protected' && enclosingBases.has(symbol.owner) &&
      (receiverType === enclosing?.type || sourceName === 'this');
  });
}

export function attachJavaEditor(monaco, host) {
  const api = monaco.languages;
  const disposables = [];
  async function context(model, pos, token) {
    if (model.getLanguageId() !== 'java') return null;
    const state = snapshot(host);
    const file = [...state.models].find(([,v]) => v.model === model)?.[0];
    if (!file) return null;
    const analysis = await host.analyze(state.files);
    if (!fresh(host, state, token)) return null;
    const symbols = analysis.bindings || [];
    return {state, analysis, symbols, file, at:symbolAt(symbols, file, model.getOffsetAt(pos))};
  }
  const location = (state, s) => {
    const m = state.models.get(s.file)?.model;
    return m && {uri:m.uri, range:modelRange(m,s)};
  };
  disposables.push(api.registerDefinitionProvider('java', {
    async provideDefinition(m,p,t) {
      const c = await context(m,p,t);
      if (!c?.at) return null;
      let key = c.at.key;
      if (c.at.constructor === true && !c.symbols.some(s => s.declaration && s.key === key)) {
        key = c.symbols.find(s => s.file === c.at.file && s.start === c.at.start && s.kind === 'type')?.key;
      }
      return c.symbols.filter(s => s.declaration && s.key === key).map(s => location(c.state,s));
    },
  }), api.registerReferenceProvider('java', {
    async provideReferences(m,p,options,t) {
      const c = await context(m,p,t);
      if (!c?.at) return [];
      const keys = related(c.symbols,c.at);
      return c.symbols.filter(s => keys.has(s.key) && (options.includeDeclaration || !s.declaration)).map(s => location(c.state,s));
    },
  }), api.registerHoverProvider('java', {
    async provideHover(m,p,t) {
      const c = await context(m,p,t), s = c?.at;
      if (!s) return null;
      const qualified = (s.owner ? s.owner + '.' : '') + s.name;
      const label = s.kind === 'method' ? s.type + ' ' + qualified + '(' + s.parameters.join(', ') + ')' :
        (s.kind === 'type' ? s.type : s.type + ' ' + qualified);
      return {range:modelRange(m,s), contents:[{value:'`' + label + '`'}]};
    },
  }), api.registerRenameProvider('java', {
    async resolveRenameLocation(m,p,t) {
      const c = await context(m,p,t);
      if (!c) return {rejectReason:'The Java workspace changed.'};
      const rejectReason = renameProblem(c.symbols,c.at);
      return rejectReason ? {rejectReason} : {range:modelRange(m,c.at), text:c.at.name};
    },
    async provideRenameEdits(m,p,name,t) {
      const c = await context(m,p,t);
      if (!c) return {edits:[], rejectReason:'The Java workspace changed.'};
      const plan = await renamePlan(c.state.files,c.analysis,c.at,name,files => host.analyze(files));
      if (!fresh(host,c.state,t)) return {edits:[],rejectReason:'The Java workspace changed. Repeat the rename.'};
      if (plan.rejectReason) return plan;
      return {edits:plan.edits.map(s => {
        const entry = c.state.models.get(s.file);
        return {resource:entry.model.uri,versionId:entry.version,textEdit:{range:modelRange(entry.model,s),text:name}};
      })};
    },
  }), api.registerCompletionItemProvider('java', {
    triggerCharacters:['.'],
    async provideCompletionItems(m,p,_context,t) {
      const c = await context(m,p,t);
      if (!c) return {suggestions:[]};
      const word = m.getWordUntilPosition(p);
      const insert = {startLineNumber:p.lineNumber,endLineNumber:p.lineNumber,startColumn:word.startColumn,endColumn:p.column};
      const currentWord = m.getWordAtPosition(p);
      const range = {insert,replace:{...insert,endColumn:currentWord?.endColumn || p.column}};
      const before = c.state.files[c.file].slice(0,m.getOffsetAt({lineNumber:p.lineNumber,column:word.startColumn}));
      const receiver = /([$_\p{ID_Start}][$_\p{ID_Continue}]*)\s*\.\s*$/u.exec(before);
      const declarations = memberCompletions(c,receiver,before.length);
      return {suggestions:declarations.map(s => ({
        label:s.name, insertText:s.name, range,
        kind:({method:api.CompletionItemKind.Method,field:api.CompletionItemKind.Field,type:api.CompletionItemKind.Class})[s.kind],
        detail:s.kind === 'method' ? s.type + ' ('+s.parameters.join(', ')+')' : s.type,
      }))};
    },
  }));
  if (host.openFile && monaco.editor.registerEditorOpener) {
    disposables.push(monaco.editor.registerEditorOpener({openCodeEditor(_source,resource,selection) {
      for (const [file, entry] of Object.entries(host.getModels())) {
        if ((entry.model || entry).uri.toString() === resource.toString()) {
          const range = selection?.lineNumber ? {startLineNumber:selection.lineNumber,startColumn:selection.column,
            endLineNumber:selection.lineNumber,endColumn:selection.column} : selection;
          return host.openFile(file,range);
        }
      }
      return false;
    }}));
  }
  return {dispose() {for (const d of disposables) d.dispose();}};
}
