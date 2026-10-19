/** Limitations belong to the inferred sequence, including exports and popouts. */
(function (global) {
  'use strict';
  const messages = {
    recursion: 'Recursive call detected. Expansion stops here; termination is not checked. Later calls and returns may be unreachable.',
    depth: 'Call-depth limit reached. Deeper interactions are omitted; their termination is not checked.',
    loop: 'Potentially unbounded loop. Termination is not checked; later calls may be unreachable.',
    unresolved: 'Some calls could not be resolved to supplied source. Their interactions are omitted.',
    control: 'Early exits or exception paths are approximated. Later calls may be unreachable on some paths.',
    conditional: 'Conditional or short-circuit expressions are approximated. Not every displayed call necessarily executes.',
    deferred: 'Asynchronous, generator, or callback execution is not modeled. Displayed order may differ at runtime.',
    ordering: 'Argument evaluation order is approximated. C++ may evaluate argument calls in a different order.',
    dispatch: 'Dynamic dispatch or overload selection is ambiguous. A displayed implementation may differ at runtime.',
    identity: 'Receiver identity depends on the path taken. A symbolic lifeline represents the possible objects.',
    unsupported: 'Some syntax is outside the supported inference subset. Interactions may be missing.'
  };

  class SequenceDiagnostics {
    constructor() { this.items = new Map(); }

    add(code, detail = '') {
      if (!this.items.has(code)) this.items.set(code, {
        code, message: messages[code] + (detail ? ' (' + detail.replace(/[\r\n]/g, ' ').slice(0, 100) + ')' : '')
      });
    }

    canExpand(label, recursive, depth, maximum) {
      if (recursive) this.add('recursion', label);
      else if (depth >= maximum) this.add('depth', label);
      return !recursive && depth < maximum;
    }

    result(syntax, { failed = false } = {}) {
      const sequenceWarnings = [...this.items.values()];
      if (failed) return { sequenceDiagram: '', sequenceWarnings };
      if (sequenceWarnings.length) {
        if (!syntax) syntax = '@startuml\nparticipant Main as : Main\n@enduml';
        // A note travels with the diagram into tutorials, popouts, and SVG
        // exports. Wrap real lines; the renderer does not interpret \n escapes.
        const text = ['Warning: partial sequence inference.', ...sequenceWarnings.map(item => item.message)].join('\n');
        const lines = text.split('\n').flatMap(line => line.match(/.{1,64}(?:\s|$)|\S{1,64}/g).map(part => part.trim()));
        const source = syntax.split('\n');
        const index = source.findLastIndex(line => /^participant /.test(line)) + 1;
        source.splice(index, 0, 'note over Main', ...lines, 'end note');
        syntax = source.join('\n');
      }
      return { sequenceDiagram: syntax, sequenceWarnings };
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = SequenceDiagnostics;
  global.UMLSequenceDiagnostics = SequenceDiagnostics;
})(typeof window !== 'undefined' ? window : globalThis);
