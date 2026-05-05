/*
 * uml-auto-describe.js — verbal aria-label generator for ArchUML diagrams.
 *
 * Mirrors the server-side describer in `_plugins/uml_static.rb` so the live
 * (client-rendered) tutorials, popouts, and dev-mode SEBook pages get the
 * same WCAG 2.2 §1.1.1 text alternative as the static production build.
 *
 * The bundle in `js/ArchUML/uml-bundle.js` exposes
 * `window.UMLShared.applySvgAccessibility(el, type, syntax)` and calls it
 * after every render. We monkey-patch that function so it falls through to
 * the original (which sets `role="img"`, classes, etc.) and then overrides
 * the `aria-label` with a structural walk-through derived from the spec.
 *
 * Falls back gracefully: if `UMLShared` never loads, never patches; if the
 * spec can't be parsed, leaves whatever the bundle set in place.
 */
(function () {
  'use strict';

  // ---------- helpers ----------

  function pluralize(n, singular, plural) {
    return n === 1 ? '1 ' + singular : n + ' ' + plural;
  }

  function formatMultValue(m) {
    if (!m) return 'one';
    switch (m) {
      case '*':
      case '0..*': return 'many';
      case '1..*': return 'one or more';
      case '0..1': return 'zero or one';
      case '1':    return 'one';
      default:     return m;
    }
  }

  function formatMult(fromMult, toMult) {
    if (!fromMult && !toMult) return '';
    return ' with multiplicity ' + formatMultValue(fromMult) + ' to ' + formatMultValue(toMult);
  }

  function stripDecorations(spec) {
    var text = String(spec || '');
    // Multi-line note blocks
    text = text.replace(/^[ \t]*note\b[^\n]*\n[\s\S]*?^[ \t]*end\s*note[ \t]*$/gim, '');
    // Single-line notes
    text = text.replace(/^[ \t]*note\b[^:\n]+:[^\n]*$/gim, '');
    // Caption directives
    text = text.replace(/^[ \t]*(?:(?:\/\/|#|'|%%)\s*)?caption\s*:[^\n]*$/gim, '');
    // Boilerplate
    text = text.replace(/^[ \t]*@(?:startuml|enduml)[ \t]*$/gim, '');
    text = text.replace(/^[ \t]*layout\s+[^\n]*$/gim, '');
    return text;
  }

  function fallbackCaption(type) {
    var map = {
      'class': 'UML class diagram',
      'sequence': 'UML sequence diagram',
      'state': 'UML state diagram',
      'component': 'UML component diagram',
      'deployment': 'UML deployment diagram',
      'usecase': 'UML use case diagram',
      'activity': 'UML activity diagram',
      'freeform': 'Freeform diagram',
      'gitgraph': 'Git graph diagram',
      'folder-tree': 'Folder tree diagram',
      'venn': 'Venn diagram',
      'er': 'Entity-relationship diagram'
    };
    return map[String(type || '').toLowerCase()] || 'ArchUML diagram';
  }

  // ---------- class diagrams ----------

  // Longest-arrow-first so e.g. '--|>' isn't matched as '--' first.
  var CLASS_ARROWS = ['<-->', '--|>', '..|>', '<|--', '<|..', '*--', '--*', 'o--', '--o',
                      '..>', '<..', '-->', '<--', 'x--x', 'x--', '--x', '..', '--'];

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function describeClassDiagram(spec) {
    var bodyStripped = spec.replace(/\{[^{}]*\}/gm, ''); // drop class bodies

    var classes = [], abstracts = [], interfaces = [];
    var relationships = [];

    var arrowAlt = CLASS_ARROWS.map(escapeRegex).join('|');
    var relRe = new RegExp(
      '^(\\w+)\\s*(?:"([^"]*)"\\s+)?(' + arrowAlt + ')\\s+(?:"([^"]*)"\\s+)?(\\w+)\\s*(?::\\s*(.+))?$'
    );

    bodyStripped.split('\n').forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      var m;
      if ((m = line.match(/^abstract\s+class\s+(\w+)/))) {
        if (abstracts.indexOf(m[1]) < 0) abstracts.push(m[1]);
      } else if ((m = line.match(/^class\s+(\w+)/))) {
        if (classes.indexOf(m[1]) < 0) classes.push(m[1]);
      } else if ((m = line.match(/^interface\s+(\w+)/))) {
        if (interfaces.indexOf(m[1]) < 0) interfaces.push(m[1]);
      } else if ((m = line.match(relRe))) {
        relationships.push({
          from: m[1], fromMult: m[2], arrow: m[3],
          toMult: m[4], to: m[5], label: m[6] && m[6].trim()
        });
      }
    });

    if (!classes.length && !abstracts.length && !interfaces.length && !relationships.length) {
      return 'UML class diagram.';
    }

    var items = [];
    if (classes.length) items.push(pluralize(classes.length, 'class', 'classes') + ' (' + classes.join(', ') + ')');
    if (abstracts.length) items.push(pluralize(abstracts.length, 'abstract class', 'abstract classes') + ' (' + abstracts.join(', ') + ')');
    if (interfaces.length) items.push(pluralize(interfaces.length, 'interface', 'interfaces') + ' (' + interfaces.join(', ') + ')');
    var head = items.length ? 'UML class diagram with ' + items.join(', ') + '.' : 'UML class diagram.';

    var rels = relationships.map(describeClassRel).filter(Boolean);
    return rels.length ? head + ' ' + rels.join('. ') + '.' : head;
  }

  function describeClassRel(rel) {
    var from = rel.from, to = rel.to;
    var mult = formatMult(rel.fromMult, rel.toMult);
    var label = rel.label ? ' labeled "' + rel.label + '"' : '';
    switch (rel.arrow) {
      case '--|>':  return from + ' extends ' + to;
      case '<|--':  return to + ' extends ' + from;
      case '..|>':  return from + ' implements ' + to;
      case '<|..':  return to + ' implements ' + from;
      case '*--':   return from + ' composes ' + to + mult + label;
      case '--*':   return to + ' composes ' + from + mult + label;
      case 'o--':   return from + ' aggregates ' + to + mult + label;
      case '--o':   return to + ' aggregates ' + from + mult + label;
      case '..>':   return from + ' depends on ' + to + label;
      case '<..':   return to + ' depends on ' + from + label;
      case '-->':   return from + ' references ' + to + mult + label;
      case '<--':   return to + ' references ' + from + mult + label;
      case '<-->':  return from + ' and ' + to + ' reference each other' + mult + label;
      case '--':
      case '..':    return from + ' is associated with ' + to + mult + label;
      case 'x--':
      case '--x':   return from + ' has a non-navigable association with ' + to + label;
      case 'x--x':  return from + ' and ' + to + ' have a non-navigable association' + label;
      default:      return null;
    }
  }

  // ---------- sequence diagrams ----------

  var SEQ_CONTROL = /^(activate|deactivate|create|destroy|opt|alt|else|end|loop|par|critical|break|ref|group|return)\b/i;

  function describeSequenceDiagram(spec) {
    var participants = [], messages = [];
    spec.split('\n').forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      if (SEQ_CONTROL.test(line)) return;
      var m;
      if ((m = line.match(/^(participant|actor)\s+(\w+)\s*(?::\s*(.+))?$/i))) {
        participants.push((m[3] || '').trim() || m[2]);
      } else if ((m = line.match(/^(\w+|o)\s*(->>|->|-->|<<-|<-|<--)\s*(\w+)\s*(?::\s*(.+))?$/))) {
        messages.push({ from: m[1], arrow: m[2], to: m[3], text: m[4] && m[4].trim() });
      }
    });

    if (!participants.length && !messages.length) return 'UML sequence diagram.';
    var head = participants.length
      ? 'UML sequence diagram with ' + pluralize(participants.length, 'participant', 'participants') + ' (' + participants.join(', ') + ')'
      : 'UML sequence diagram';
    if (!messages.length) return head + '.';

    var msgs = messages.map(function (m) {
      var verb;
      switch (m.arrow) {
        case '-->': case '<<-': case '<--': verb = 'replies to'; break;
        case '->>': verb = 'asynchronously messages'; break;
        case '<-':  verb = 'is called by'; break;
        default:    verb = 'calls';
      }
      var payload = m.text ? ' with "' + m.text + '"' : '';
      return m.from + ' ' + verb + ' ' + m.to + payload;
    });
    return head + '. Messages: ' + msgs.join('; ') + '.';
  }

  // ---------- state machine diagrams ----------

  function describeStateDiagram(spec) {
    var states = [];
    var seen = Object.create(null);
    var transitions = [];

    function record(name) {
      if (seen[name] || name === '[*]') return;
      seen[name] = true;
      states.push(name);
    }

    spec.split('\n').forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      var m;
      if ((m = line.match(/^state\s+(\w+)/))) {
        record(m[1]);
      } else if ((m = line.match(/^(\[\*\]|\w+)\s*-->\s*(\[\*\]|\w+)\s*(?::\s*(.+))?$/))) {
        transitions.push({ from: m[1], to: m[2], label: m[3] && m[3].trim() });
        record(m[1]); record(m[2]);
      }
    });

    if (!transitions.length && !states.length) return 'UML state machine diagram.';
    var head = states.length
      ? 'UML state machine diagram with ' + pluralize(states.length, 'state', 'states') + ' (' + states.join(', ') + ')'
      : 'UML state machine diagram';
    if (!transitions.length) return head + '.';

    var ts = transitions.map(function (t) {
      var from = t.from === '[*]' ? 'the initial pseudostate' : t.from;
      var to   = t.to   === '[*]' ? 'the final state'        : t.to;
      var tail = t.label ? ' on ' + t.label : '';
      return from + ' transitions to ' + to + tail;
    });
    return head + '. Transitions: ' + ts.join('; ') + '.';
  }

  // ---------- component diagrams ----------

  function describeComponentDiagram(spec) {
    var components = [];
    var info = Object.create(null);
    var portOwner = Object.create(null);
    var connections = [];
    var current = null;

    function ensure(name) {
      if (!info[name]) info[name] = { in: [], out: [], provides: [], requires: [] };
      return info[name];
    }

    spec.split('\n').forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      var m;
      if ((m = line.match(/^component\s+"?(\w+)"?\s*(\{?)/))) {
        if (components.indexOf(m[1]) < 0) components.push(m[1]);
        current = m[2] === '{' ? m[1] : null;
      } else if (line === '}') {
        current = null;
      } else if (current && (m = line.match(/^(portin|portout|provide|require)\s+"([^"]+)"\s+as\s+(\w+)/i))) {
        var key = { portin: 'in', portout: 'out', provide: 'provides', require: 'requires' }[m[1].toLowerCase()];
        ensure(current)[key].push(m[2]);
        portOwner[m[3]] = current;
      } else if (current && (m = line.match(/^(portin|portout|provide|require)\s+"([^"]+)"/i))) {
        var key2 = { portin: 'in', portout: 'out', provide: 'provides', require: 'requires' }[m[1].toLowerCase()];
        ensure(current)[key2].push(m[2]);
      } else if ((m = line.match(/^(\w+)\s+(-->|--|\.\.>)\s+(\w+)\s*(?::\s*(.+))?$/))) {
        var from = portOwner[m[1]] || m[1];
        var to   = portOwner[m[3]] || m[3];
        connections.push({ from: from, arrow: m[2], to: to, label: m[4] && m[4].trim() });
      }
    });

    if (!components.length && !connections.length) return 'UML component diagram.';

    var head = components.length
      ? 'UML component diagram with ' + pluralize(components.length, 'component', 'components') + ' (' + components.join(', ') + ')'
      : 'UML component diagram';

    var portLines = [];
    Object.keys(info).forEach(function (comp) {
      var h = info[comp];
      var parts = [];
      if (h.provides.length) parts.push('provides ' + h.provides.join(', '));
      if (h.requires.length) parts.push('requires ' + h.requires.join(', '));
      if (h.in.length)       parts.push('incoming ports ' + h.in.join(', '));
      if (h.out.length)      parts.push('outgoing ports ' + h.out.join(', '));
      if (parts.length) portLines.push(comp + ' ' + parts.join(', '));
    });

    var connLines = connections.map(function (c) {
      var verb;
      switch (c.arrow) {
        case '..>': verb = 'depends on'; break;
        case '-->': verb = 'connects to'; break;
        default:    verb = 'is associated with';
      }
      var label = c.label ? ' labeled "' + c.label + '"' : '';
      return c.from + ' ' + verb + ' ' + c.to + label;
    });

    var out = head + '.';
    if (portLines.length) out += ' ' + portLines.join('. ') + '.';
    if (connLines.length) out += ' Connections: ' + connLines.join('; ') + '.';
    return out;
  }

  // ---------- use case diagrams ----------

  function describeUsecaseDiagram(spec) {
    var actors = [], usecases = [];
    var aliasMap = Object.create(null);
    var relationships = [];

    spec.split('\n').forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      var m;
      if ((m = line.match(/^actor\s+"?([^"\n]+?)"?\s*(?:as\s+(\w+))?$/i))) {
        var name = m[1].trim();
        if (actors.indexOf(name) < 0) actors.push(name);
      } else if ((m = line.match(/^usecase\s+"([^"]+)"\s*as\s+(\w+)/i))) {
        if (usecases.indexOf(m[1]) < 0) usecases.push(m[1]);
        aliasMap[m[2]] = m[1];
      } else if ((m = line.match(/^(\w+)\s+(--|\.\.>|--\|>)\s+(\w+)\s*(?::\s*(.+))?$/))) {
        relationships.push({ from: m[1], arrow: m[2], to: m[3], label: m[4] && m[4].trim() });
      }
    });

    if (!actors.length && !usecases.length) return 'UML use case diagram.';

    var items = [];
    if (actors.length)   items.push(pluralize(actors.length,   'actor',    'actors')    + ' (' + actors.join(', ') + ')');
    if (usecases.length) items.push(pluralize(usecases.length, 'use case', 'use cases') + ' (' + usecases.join(', ') + ')');
    var head = 'UML use case diagram with ' + items.join(' and ');

    var rels = relationships.map(function (r) {
      function name(id) { return aliasMap[id] ? '"' + aliasMap[id] + '"' : id; }
      if (r.label && /<<\s*include\s*>>/i.test(r.label)) return name(r.from) + ' includes ' + name(r.to);
      if (r.label && /<<\s*extend\s*>>/i.test(r.label))  return name(r.from) + ' extends '  + name(r.to);
      if (r.arrow === '--|>')                            return name(r.from) + ' specializes ' + name(r.to);
      return name(r.from) + ' associates with ' + name(r.to);
    });

    return rels.length ? head + '. ' + rels.join('. ') + '.' : head + '.';
  }

  // ---------- activity / deployment (lightweight) ----------

  function describeActivityDiagram(spec) {
    var nodes = [];
    var seen = Object.create(null);
    var re = /^\s*:([^;|\n]+);/gm;
    var m;
    while ((m = re.exec(spec))) {
      var n = m[1].trim();
      if (!seen[n]) { seen[n] = true; nodes.push(n); }
    }
    if (!nodes.length) return 'UML activity diagram.';
    return 'UML activity diagram with ' + pluralize(nodes.length, 'activity', 'activities') + ' (' + nodes.join(', ') + ').';
  }

  function describeDeploymentDiagram(spec) {
    var nodes = [], artifacts = [];
    var seenN = Object.create(null), seenA = Object.create(null);
    spec.replace(/^\s*node\s+"?([^"\n{]+?)"?\s*(?:\{|$)/gim, function (_, n) {
      n = n.trim(); if (!seenN[n]) { seenN[n] = true; nodes.push(n); } return '';
    });
    spec.replace(/^\s*artifact\s+"?([^"\n]+?)"?\s*$/gim, function (_, n) {
      n = n.trim(); if (!seenA[n]) { seenA[n] = true; artifacts.push(n); } return '';
    });
    if (!nodes.length && !artifacts.length) return 'UML deployment diagram.';
    var items = [];
    if (nodes.length)     items.push(pluralize(nodes.length, 'node', 'nodes') + ' (' + nodes.join(', ') + ')');
    if (artifacts.length) items.push(pluralize(artifacts.length, 'artifact', 'artifacts') + ' (' + artifacts.join(', ') + ')');
    return 'UML deployment diagram with ' + items.join(' and ') + '.';
  }

  // ---------- dispatch ----------

  function describe(type, spec) {
    var t = String(type || '').toLowerCase();
    var s = stripDecorations(spec);
    try {
      switch (t) {
        case 'class':      return describeClassDiagram(s);
        case 'sequence':   return describeSequenceDiagram(s);
        case 'state':      return describeStateDiagram(s);
        case 'component':  return describeComponentDiagram(s);
        case 'usecase':    return describeUsecaseDiagram(s);
        case 'activity':   return describeActivityDiagram(s);
        case 'deployment': return describeDeploymentDiagram(s);
        default:           return fallbackCaption(type) + '.';
      }
    } catch (e) {
      if (window.console && console.warn) console.warn('UMLAutoDescribe failed:', e);
      return fallbackCaption(type) + '.';
    }
  }

  // Apply description to a container element (and any inner SVG it contains).
  function applyDescription(el, type, spec) {
    if (!el) return;
    var desc = describe(type, spec);
    if (!desc) return;
    el.setAttribute('aria-label', desc);
    var svg = el.tagName && el.tagName.toLowerCase() === 'svg' ? el : (el.querySelector && el.querySelector('svg'));
    if (svg) svg.setAttribute('aria-label', desc);
  }

  // Patch UMLShared.applySvgAccessibility once the bundle has loaded.
  function tryPatch() {
    if (!window.UMLShared || window.UMLShared.__umlAutoDescribePatched) return !!(window.UMLShared && window.UMLShared.__umlAutoDescribePatched);
    var orig = window.UMLShared.applySvgAccessibility;
    if (typeof orig !== 'function') return false;
    window.UMLShared.applySvgAccessibility = function (el, type, syntax) {
      try { orig.call(this, el, type, syntax); } catch (_) { /* keep going */ }
      try { applyDescription(el, type, syntax); } catch (_) { /* leave bundle's label */ }
    };
    window.UMLShared.__umlAutoDescribePatched = true;
    return true;
  }

  // Try immediately (in case bundle was loaded before us via defer ordering),
  // then poll briefly while it loads. Caps at ~5 s to avoid leaking timers.
  if (!tryPatch()) {
    var attempts = 0;
    var iv = setInterval(function () {
      attempts += 1;
      if (tryPatch() || attempts >= 50) clearInterval(iv);
    }, 100);
  }

  // Expose for direct callers (and for tests).
  window.UMLAutoDescribe = { describe: describe, apply: applyDescription };
})();
