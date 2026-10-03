(function (scope) {
  'use strict';
  const api = scope.SEBookSmalltalk;
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const entityFields = ['kind', 'packageName', 'className', 'side', 'selector', 'protocol', 'path'];
  function reject(message) { throw api.runtimeError('PRECONDITION_FAILED', message); }
  function entity(value) {
    api.validateOperation('browse', { kind: 'packages', target: value, offset: 0, limit: 1 });
    const target = Object.fromEntries(entityFields.filter(key => value[key] !== undefined).map(key => [key, value[key]]));
    if (Object.values(target).some(field => typeof field !== 'string')) reject('Invalid saved entity');
    if (target.kind === 'file') target.path = api.normalizeProgram({ stepKey: 'path', files: [{ path: target.path, content: '', language: 'plaintext' }] }).files[0].path;
    return target;
  }
  /** Project only source metadata. Runtime objects/checkpoints are never progress. */
  function program(value) {
    if (!object(value) || value.version !== 1 || typeof value.stepKey !== 'string' || !value.stepKey ||
        !Number.isSafeInteger(value.revision) || value.revision < 0 || !Array.isArray(value.files)) reject('Invalid saved Program');
    const files = value.files.map(file => {
      if (!object(file) || !['source', 'resource'].includes(file.kind) ||
          (file.kind === 'source' ? !['filein', 'doit'].includes(file.format) : file.format !== null)) reject('Invalid saved source file');
      return { path: file.path, content: file.content, language: file.kind === 'source' ? 'smalltalk' : 'plaintext',
        ...(file.kind === 'source' ? { smalltalk_format: file.format } : {}) };
    });
    const normalized = api.normalizeProgram({ stepKey: value.stepKey, files, runCommand: value.runCommand });
    const changes = value.changes;
    if (!object(changes) || changes.version !== 1 || typeof changes.source !== 'string' || !Array.isArray(changes.entries)) reject('Invalid saved native changes');
    const entries = changes.entries.map(entry => {
      if (!object(entry) || ![entry.before, entry.after].every(source => source === null || typeof source === 'string')) reject('Invalid saved change entry');
      return { entity: entity(entry.entity), before: entry.before, after: entry.after };
    });
    return { ...normalized, revision: value.revision, changes: { version: 1, source: changes.source, entries } };
  }
  function draft(value) {
    if (!object(value) || !Number.isSafeInteger(value.baseRevision) || value.baseRevision < 0 || typeof value.source !== 'string') reject('Invalid saved draft');
    return { target: entity(value.target), baseRevision: value.baseRevision, source: value.source };
  }
  function recoverDrafts(values, warnings) {
    if (!Array.isArray(values)) { if (values !== undefined) warnings.push('Saved drafts were malformed; invalid entries were not loaded.'); return []; }
    const recovered = [];
    for (const value of values) {
      try { recovered.push(draft(value)); }
      catch (error) { warnings.push('A malformed saved draft was not loaded: ' + error.message); }
    }
    return recovered;
  }
  function recoverLegacyFiles(declared, accepted, drafts, legacyFiles, missingRecord, warnings) {
    const migrated = new Map();
    if (!object(legacyFiles)) return {};
    const aliases = new Map(declared.files.map(file => [file.path, []]));
    for (const [key, value] of Object.entries(legacyFiles)) {
      if (!object(value) || typeof value.content !== 'string') continue;
      try {
        const normalized = api.normalizeProgram({ stepKey: 'legacy-path', files: [{ path: key, content: '', language: 'plaintext' }] }).files[0].path;
        if (aliases.has(normalized)) aliases.get(normalized).push({ key, source: value.content });
      } catch (_) { /* Unknown or unsafe legacy paths remain available for export. */ }
    }
    for (const file of declared.files) {
      const matches = aliases.get(file.path);
      if (!matches.length) continue;
      // Exact canonical key first; remaining aliases have a stable code-unit
      // order independent of JSON insertion order or browser locale.
      matches.sort((a, b) => (a.key === file.path ? -1 : b.key === file.path ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
      const selected = matches[0];
      if (missingRecord && selected.source !== file.content) drafts.push({ target: { kind: 'file', path: file.path }, baseRevision: declared.revision, source: selected.source });
      const represented = new Set(accepted.files.filter(source => source.path === file.path).map(source => source.content));
      drafts.filter(draft => draft.target.kind === 'file' && draft.target.path === file.path).forEach(draft => represented.add(draft.source));
      const unresolved = matches.filter(alias => !represented.has(alias.source));
      matches.filter(alias => represented.has(alias.source)).forEach(alias => migrated.set(alias.key, alias.source));
      if (unresolved.length) warnings.push('Conflicting saved source for ' + JSON.stringify(file.path) + ' from ' +
        matches.map(alias => JSON.stringify(alias.key)).join(', ') + '. ' +
        (missingRecord ? 'Loaded ' + JSON.stringify(selected.key) + ' as the canonical source or unaccepted draft. ' : 'Restored accepted code and drafts were kept. ') +
        'Other versions remain in the original progress record for export.');
    }
    return Object.fromEntries(migrated);
  }
  function sourceFields(value, names) {
    if (!object(value)) return null;
    return Object.fromEntries(names.filter(key => Object.hasOwn(value, key)).map(key => {
      const field = value[key];
      return [key, field === null || ['string', 'number', 'boolean'].includes(typeof field) ? field : null];
    }));
  }
  function sourceProgram(value) {
    if (!object(value)) return null;
    const result = sourceFields(value, ['version', 'stepKey', 'revision', 'runCommand']);
    result.files = Array.isArray(value.files) ? value.files.map(file => sourceFields(file, ['path', 'kind', 'format', 'content'])) : null;
    result.changes = sourceFields(value.changes, ['version', 'source']);
    if (result.changes) result.changes.entries = Array.isArray(value.changes.entries) ? value.changes.entries.map(entry => ({
      ...sourceFields(entry, ['before', 'after']), entity: sourceFields(entry && entry.entity, entityFields),
    })) : null;
    return result;
  }
  function priorRecord(value, version, key) {
    const result = { program: sourceProgram(value && value.program), drafts: object(value) && Array.isArray(value.drafts)
      ? value.drafts.map(saved => ({ ...sourceFields(saved, ['baseRevision', 'source']), target: sourceFields(saved && saved.target, entityFields) })) : null };
    try {
      if (version !== 1) reject('Unsupported saved workspace version');
      if (!object(value) || value.invalid !== undefined) reject(object(value) && typeof value.invalid === 'string' ? value.invalid : 'Malformed saved step');
      result.program = program(value.program);
      if (result.program.stepKey !== key) reject('Saved step identity does not match its key');
    } catch (error) { result.invalid = error.message; }
    return result;
  }
  /** Encode the active accepted Program and drafts, preserving other stable keys. */
  api.encodeProgress = function (workspace, previous) {
    const steps = new Map();
    if (object(previous) && object(previous.steps)) {
      for (const [key, value] of Object.entries(previous.steps)) {
        // Quarantine invalid/future records rather than silently promoting them
        // when this save wraps the other steps in a current-version envelope.
        steps.set(key, priorRecord(value, previous.version, key));
      }
    }
    const accepted = program(workspace.snapshot());
    steps.set(accepted.stepKey, { program: accepted, drafts: workspace.getDrafts().map(draft) });
    return { version: 1, steps: Object.fromEntries(steps) };
  };
  /** Decode source first, then drafts. Legacy file edits never become accepted code. */
  api.decodeProgress = function (value, starter, legacyFiles = {}) {
    const declared = program(starter);
    const warnings = [];
    const record = object(value) && object(value.steps) ? value.steps[declared.stepKey] : undefined;
    let accepted = declared;
    let drafts = object(record) ? recoverDrafts(record.drafts, warnings) : [];
    if (value !== undefined && value !== null) {
      if (!object(value) || value.version !== 1 || !object(value.steps)) warnings.push('Saved Smalltalk workspace format is malformed or unsupported; starter code was loaded and recoverable drafts retained.');
      else if (record !== undefined) {
        try {
          if (!object(record)) reject('Invalid saved step');
          if (record.invalid !== undefined) reject(typeof record.invalid === 'string' ? record.invalid : 'Quarantined saved step');
          accepted = program(record.program);
          if (accepted.stepKey !== declared.stepKey) reject('Saved step identity does not match this lesson');
          accepted.runCommand = declared.runCommand;
        } catch (error) {
          accepted = declared;
          warnings.push('Saved accepted Smalltalk code was not loaded: ' + error.message + '. Starter code and recoverable drafts were retained.');
        }
      }
    }
    const migratedLegacyFiles = recoverLegacyFiles(declared, accepted, drafts, legacyFiles, !record, warnings);
    return { program: accepted, drafts, warnings, migratedLegacyFiles };
  };
})(typeof window === 'object' ? window : self);
