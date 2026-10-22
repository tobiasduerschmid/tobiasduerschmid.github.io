/*
 * uml-auto-describe.js — verbal aria-label generator for ArchUML diagrams.
 *
 * Provides the WCAG 2.2 §1.1.1 text alternative for client-rendered
 * diagrams across SEBook pages, tutorials, and popouts.
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
    if (!m) return 'unspecified';
    switch (m) {
      case '*':
      case '0..*': return 'zero or more';
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
      'er': 'Entity-relationship diagram',
      'crc': 'Class-responsibility-collaborator cards'
    };
    return map[String(type || '').toLowerCase()] || 'ArchUML diagram';
  }

  // ---------- class diagrams ----------

  // Match the public class renderer's supported ownership/navigation markers.
  // Reverse aliases swap both endpoints and their multiplicities before prose
  // generation; the diamond continues to identify the whole.
  var CLASS_ARROW_TYPES = {
    '--|>': { verb: 'extends' },
    '<|--': { verb: 'extends', reverse: true },
    '..|>': { verb: 'implements' },
    '<|..': { verb: 'implements', reverse: true },
    '*--': { verb: 'composes' },
    '*-->': { verb: 'composes', toNavigation: 'navigable' },
    '*<-->': { verb: 'composes', fromNavigation: 'navigable', toNavigation: 'navigable' },
    '*--x': { verb: 'composes', toNavigation: 'non-navigable' },
    '*x-->': { verb: 'composes', fromNavigation: 'non-navigable', toNavigation: 'navigable' },
    '*<--x': { verb: 'composes', fromNavigation: 'navigable', toNavigation: 'non-navigable' },
    'o--': { verb: 'aggregates' },
    'o-->': { verb: 'aggregates', toNavigation: 'navigable' },
    'o<-->': { verb: 'aggregates', fromNavigation: 'navigable', toNavigation: 'navigable' },
    'o--x': { verb: 'aggregates', toNavigation: 'non-navigable' },
    'ox-->': { verb: 'aggregates', fromNavigation: 'non-navigable', toNavigation: 'navigable' },
    'o<--x': { verb: 'aggregates', fromNavigation: 'navigable', toNavigation: 'non-navigable' },
    '--*': { verb: 'composes', reverse: true },
    '<--*': { verb: 'composes', reverse: true, toNavigation: 'navigable' },
    '<-->*': { verb: 'composes', reverse: true, fromNavigation: 'navigable', toNavigation: 'navigable' },
    'x--*': { verb: 'composes', reverse: true, toNavigation: 'non-navigable' },
    '--o': { verb: 'aggregates', reverse: true },
    '<--o': { verb: 'aggregates', reverse: true, toNavigation: 'navigable' },
    '<-->o': { verb: 'aggregates', reverse: true, fromNavigation: 'navigable', toNavigation: 'navigable' },
    'x--o': { verb: 'aggregates', reverse: true, toNavigation: 'non-navigable' },
    '*<-->x': { verb: 'composes', toNavigation: 'non-navigable' },
    '-->': { verb: 'references' },
    '<--': { verb: 'references', reverse: true },
    '<-->': { verb: 'reference each other', symmetric: true },
    '--': { verb: 'is associated with' },
    'x-->': { verb: 'is associated with', fromNavigation: 'non-navigable', toNavigation: 'navigable' },
    '<--x': { verb: 'is associated with', fromNavigation: 'navigable', toNavigation: 'non-navigable' },
    '--x': { verb: 'has a non-navigable association with', toNavigation: 'non-navigable' },
    'x--': { verb: 'has a non-navigable association with', reverse: true, toNavigation: 'non-navigable' },
    'x--x': { verb: 'is associated with', fromNavigation: 'non-navigable', toNavigation: 'non-navigable' },
    '..>': { verb: 'depends on' },
    // Retain the describer's existing compatibility with dotted associations.
    '<..': { verb: 'depends on', reverse: true },
    '..': { verb: 'is associated with' }
  };
  var CLASS_ARROWS = Object.keys(CLASS_ARROW_TYPES).sort(function (a, b) { return b.length - a.length; });

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function describeClassDiagram(spec) {
    var bodyStripped = spec.replace(/\{[^{}]*\}/gm, ''); // drop class bodies

    var classes = [], abstracts = [], interfaces = [];
    var relationships = [];

    var arrowAlt = CLASS_ARROWS.map(escapeRegex).join('|');
    var relRe = new RegExp(
      '^(\\w+)\\s*(?:["\']([^"\']*)["\']\\s+)?(' + arrowAlt + ')\\s+(?:["\']([^"\']*)["\']\\s+)?(\\w+)\\s*(?::\\s*(.+))?$'
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

  function describeClassNavigation(from, to, arrow) {
    if (arrow.fromNavigation === 'navigable' && arrow.toNavigation === 'navigable') {
      return '; navigable in both directions';
    }
    if (arrow.fromNavigation === 'non-navigable' && arrow.toNavigation === 'non-navigable') {
      return '; not navigable in either direction';
    }
    const directions = [];
    if (arrow.fromNavigation) {
      directions.push((arrow.fromNavigation === 'non-navigable' ? 'not ' : '') + 'navigable from ' + to + ' to ' + from);
    }
    if (arrow.toNavigation) {
      directions.push((arrow.toNavigation === 'non-navigable' ? 'not ' : '') + 'navigable from ' + from + ' to ' + to);
    }
    return directions.length ? '; ' + directions.join('; ') : '';
  }

  function describeClassRel(rel) {
    const arrow = CLASS_ARROW_TYPES[rel.arrow];
    if (!arrow) return null;
    const from = arrow.reverse ? rel.to : rel.from;
    const to = arrow.reverse ? rel.from : rel.to;
    const mult = arrow.reverse ? formatMult(rel.toMult, rel.fromMult) : formatMult(rel.fromMult, rel.toMult);
    const label = rel.label ? ' labeled "' + rel.label + '"' : '';
    const relation = arrow.symmetric ? from + ' and ' + to + ' ' + arrow.verb : from + ' ' + arrow.verb + ' ' + to;
    return relation + mult + label + describeClassNavigation(from, to, arrow);
  }

  // ---------- sequence diagrams ----------

  // Combined-fragment opening keywords (Mermaid/PlantUML/ArchUML share this set).
  // `else` separates branches inside an open fragment; `end` closes one. Lifecycle
  // verbs (`activate` etc.) and `ref`/`return` are non-message lines we drop.
  var SEQ_FRAGMENT_OPEN = /^(opt|alt|loop|par|critical|break|group)\b\s*(.*)$/i;
  var SEQ_FRAGMENT_ELSE = /^else\b\s*(.*)$/i;
  var SEQ_FRAGMENT_END  = /^end\b/i;
  var SEQ_LIFECYCLE     = /^(activate|deactivate|create|destroy|return|ref)\b/i;

  function fragmentLabel(kind, rawLabel) {
    var label = String(rawLabel || '').trim().replace(/^\[(.*)\]$/, '$1').trim();
    var bracketed = label ? ' [' + label + ']' : '';
    switch (kind) {
      case 'alt':      return 'alt branch' + bracketed;
      case 'opt':      return 'optional fragment' + bracketed;
      case 'loop':     return 'loop' + bracketed;
      case 'par':      return 'parallel branch' + bracketed;
      case 'critical': return 'critical region' + bracketed;
      case 'break':    return 'break' + bracketed;
      case 'group':    return 'group' + bracketed;
      default:         return kind + bracketed;
    }
  }

  function fragmentSignature(stack) {
    return stack.map(function (f) { return f.id + ':' + f.kind + ':' + f.label; }).join('|');
  }

  function fragmentPrefix(stack) {
    if (!stack.length) return '';
    return 'in ' + stack.map(function (f) {
      return fragmentLabel(f.kind, f.label);
    }).join(', within ');
  }

  // Shared parser: walks the sequence spec once, tracking the open fragment
  // stack so each message carries its control-flow context. Both the brief
  // describer and the verbose screen-reader-only description use this so an
  // `alt`/`else` pair no longer collapses into a flat list of messages.
  function parseSequenceSpec(spec) {
    var participants = [];
    var participantIds = Object.create(null);
    var messages = [];
    var stack = [];
    var nextFragmentId = 0;
    String(spec || '').split('\n').forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      var m;
      if ((m = line.match(SEQ_FRAGMENT_OPEN))) {
        stack.push({ id: nextFragmentId++, kind: m[1].toLowerCase(), label: (m[2] || '').trim() });
        return;
      }
      if ((m = line.match(SEQ_FRAGMENT_ELSE))) {
        if (stack.length) stack[stack.length - 1].label = (m[1] || '').trim();
        return;
      }
      if (SEQ_FRAGMENT_END.test(line)) {
        stack.pop();
        return;
      }
      if (SEQ_LIFECYCLE.test(line)) return;
      if ((m = line.match(/^(participant|actor)\s+(\w+)\s*(?::\s*(.+))?$/i))) {
        if (!participantIds[m[2]]) {
          participantIds[m[2]] = true;
          participants.push((m[3] || '').trim() || m[2]);
        }
        return;
      }
      if ((m = line.match(/^(\w+|o)\s*(->>|->|-->|<<-|<-|<--)\s*(\w+)\s*(?::\s*(.+))?$/))) {
        // Deep-copy frames so a later `else` that mutates the live stack
        // doesn't retroactively rewrite this message's branch label.
        var frozenPath = stack.map(function (f) { return { id: f.id, kind: f.kind, label: f.label }; });
        messages.push({
          from: m[1], arrow: m[2], to: m[3],
          text: m[4] && m[4].trim(),
          fragmentPath: frozenPath
        });
      }
    });
    // The renderer also draws undeclared message endpoints, such as Main.
    // Resolve declarations first so aliases do not create duplicate lifelines.
    messages.forEach(function (message) {
      [message.from, message.to].forEach(function (id) {
        if (id !== 'o' && !participantIds[id]) {
          participantIds[id] = true;
          participants.push(id);
        }
      });
    });
    return { participants: participants, messages: messages };
  }

  function messageVerb(arrow) {
    switch (arrow) {
      case '-->': case '<<-': case '<--': return 'replies to';
      case '->>': return 'asynchronously messages';
      case '<-':  return 'is called by';
      default:    return 'calls';
    }
  }

  function describeSequenceMessage(message) {
    if (/^<<create>>$/i.test(message.text || '')) {
      var reversed = message.arrow.charAt(0) === '<';
      return (reversed ? message.to : message.from) + ' creates ' + (reversed ? message.from : message.to);
    }
    var payload = message.text ? ' with "' + message.text + '"' : '';
    return message.from + ' ' + messageVerb(message.arrow) + ' ' + message.to + payload;
  }

  function describeSequenceDiagram(spec) {
    var parsed = parseSequenceSpec(spec);
    var participants = parsed.participants;
    var messages = parsed.messages;

    if (!participants.length && !messages.length) return 'UML sequence diagram.';
    var head = participants.length
      ? 'UML sequence diagram with ' + pluralize(participants.length, 'participant', 'participants') + ' (' + participants.join(', ') + ')'
      : 'UML sequence diagram';
    if (!messages.length) return head + '.';

    var prevSig = '';
    var msgs = messages.map(function (m) {
      var body = describeSequenceMessage(m);
      var sig = fragmentSignature(m.fragmentPath);
      if (sig !== prevSig) {
        prevSig = sig;
        var prefix = fragmentPrefix(m.fragmentPath);
        if (prefix) return prefix + ', ' + body;
        return 'outside combined fragments, ' + body;
      }
      return body;
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

  // Source-only descriptions also run without the renderer (for static output).
  // Split declarations outside quoted names so inline node contents and escaped
  // display names have the same identities as their visible SVG counterparts.
  function parseDeploymentDescription(spec) {
    var source = stripDecorations(spec)
      .replace(/^\s*@layout\b[^\n]*\n[\s\S]*?^\s*@endlayout[^\n]*$/gim, '')
      .replace(/\s+@pos\([^)]*\)/g, '');
    var elements = [], links = [], byId = Object.create(null);
    var parent = null, pendingParent = null, text = '', quoted = false, escaped = false;
    function unquote(value) { return String(value || '').replace(/^"|"$/g, '').replace(/\\(["\\])/g, '$1'); }
    function addStatement(statement) {
      var line = statement.trim();
      if (!line) return;
      var match = line.match(/^(node|component|artifact)\s+("(?:\\.|[^"\\])*"|[^\s{}]+)(?:\s+as\s+("(?:\\.|[^"\\])*"|[^\s{}]+))?(?:\s+<<([^>]+)>>)?/i);
      if (match) {
        var id = unquote(match[3] || match[2]);
        var element = { id: id, label: unquote(match[2]), kind: match[1].toLowerCase(), parentId: parent, stereotype: match[4] || '' };
        if (!byId[id]) { byId[id] = element; elements.push(element); }
        pendingParent = element.kind === 'node' ? id : null;
        return;
      }
      var relation = line.match(/^("(?:\\.|[^"\\])*"|\S+)\s+(-->|\.\.>|--)\s+("(?:\\.|[^"\\])*"|\S+?)(?:\s+(dashed))?\s*(?::\s*(.*))?$/);
      if (relation) links.push({ from: unquote(relation[1]), to: unquote(relation[3]), arrow: relation[2], dashed: !!relation[4], label: relation[5] || '' });
    }
    for (var i = 0; i < source.length; i++) {
      var ch = source[i];
      if (escaped) { text += ch; escaped = false; continue; }
      if (quoted && ch === '\\') { text += ch; escaped = true; continue; }
      if (ch === '"') { quoted = !quoted; text += ch; continue; }
      if (!quoted && /[{};\n]/.test(ch)) {
        addStatement(text); text = '';
        if (ch === '{') { parent = pendingParent; pendingParent = null; }
        else if (ch === '}') { parent = null; pendingParent = null; }
      } else text += ch;
    }
    addStatement(text);
    links.forEach(function(link) {
      [link.from, link.to].forEach(function(id) {
        if (!byId[id]) { var element = { id: id, label: id, kind: 'node', parentId: null, stereotype: '' }; byId[id] = element; elements.push(element); }
      });
    });
    return { elements: elements, links: links, byId: byId };
  }

  function deploymentSummary(parsed) {
    var items = [];
    ['node', 'artifact', 'component'].forEach(function(kind) {
      var names = parsed.elements.filter(function(element) { return element.kind === kind; }).map(function(element) { return element.label; });
      if (names.length) items.push(pluralize(names.length, kind, kind + 's') + ' (' + names.join(', ') + ')');
    });
    if (!items.length) return 'UML deployment diagram.';
    return 'UML deployment diagram with ' + items.join(' and ') + '.';
  }

  function describeDeploymentDiagram(spec) { return deploymentSummary(parseDeploymentDescription(spec)); }

  // ---------- gitgraph (commit DAG) ----------
  // Spec syntax (see ArchUML REFERENCE):
  //   branch main:
  //     A "Initial commit"
  //     B "Add auth"
  //   branch feature from B:
  //     α "Start OAuth"
  //   head main

  function describeGitgraphDiagram(spec) {
    var branches = [];
    var byName = Object.create(null);
    var totalCommits = 0;
    var head = null;
    var current = null;

    spec.split('\n').forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      var m;
      if ((m = line.match(/^branch\s+(\w[\w./-]*)\s*(?:from\s+(\w+))?\s*:/i))) {
        var br = { name: m[1], from: m[2] || null, commits: [] };
        if (!byName[br.name]) {
          branches.push(br);
          byName[br.name] = br;
        }
        current = byName[br.name];
      } else if ((m = line.match(/^head\s+(\w[\w./-]*)/i))) {
        head = m[1];
      } else if (current && (m = line.match(/^(\S+)\s*"([^"]*)"/))) {
        current.commits.push({ id: m[1], msg: m[2] });
        totalCommits += 1;
      }
    });

    if (!branches.length && !head) return 'Git commit graph.';

    var head_part = head ? 'HEAD on ' + head : '';
    var branch_part = branches.length
      ? pluralize(branches.length, 'branch', 'branches') + ' (' +
        branches.map(function (b) {
          var summary = b.name + ' with ' + pluralize(b.commits.length, 'commit', 'commits');
          if (b.from) summary += ', branched from ' + b.from;
          if (b.commits.length) {
            var msgs = b.commits.slice(0, 4).map(function (c) { return '"' + c.msg + '"'; });
            if (b.commits.length > 4) msgs.push('and ' + (b.commits.length - 4) + ' more');
            summary += ': ' + msgs.join(', ');
          }
          return summary;
        }).join('; ') + ')'
      : '';

    var head_summary = head_part ? '. ' + head_part + '.' : '.';
    if (!branch_part) return 'Git commit graph' + head_summary;
    return 'Git commit graph with ' + pluralize(totalCommits, 'commit', 'commits') + ' across ' + branch_part + head_summary;
  }

  // ---------- folder-tree ----------
  // Indentation-based; trailing '/' marks a folder, otherwise a file.

  function describeFolderTreeDiagram(spec) {
    var lines = spec.split('\n');
    var indentUnit = 0;
    var nonEmpty = [];
    lines.forEach(function (raw) {
      if (!raw.trim()) return;
      nonEmpty.push(raw);
      if (!indentUnit) {
        var lead = raw.match(/^(\s*)/)[1].length;
        if (lead > 0) indentUnit = lead;
      }
    });
    if (!nonEmpty.length) return 'Folder tree diagram.';

    var folders = 0, files = 0;
    var rootName = null;
    var topLevel = [];
    nonEmpty.forEach(function (raw, i) {
      var lead = raw.match(/^(\s*)/)[1].length;
      var depth = indentUnit > 0 ? Math.floor(lead / indentUnit) : 0;
      // Strip annotations (← note, # note, // note) and color tags (#aabbcc, named).
      var name = raw.trim()
        .replace(/\s+(?:←|<-|#|\/\/)\s+.*$/, '')
        .replace(/\s+#[\w]+(?:\s+\w+)?$/, '')
        .trim();
      if (!name) return;
      if (depth === 0 && rootName === null) {
        rootName = name;
        if (/\/$/.test(name)) folders += 1; else files += 1;
        return;
      }
      if (/\/$/.test(name)) {
        folders += 1;
        if (depth === 1) topLevel.push(name);
      } else {
        files += 1;
        if (depth === 1) topLevel.push(name);
      }
    });

    var head = 'Folder tree';
    if (rootName) head += ' rooted at ' + rootName;
    var counts = pluralize(folders, 'folder', 'folders') + ' and ' + pluralize(files, 'file', 'files');
    var detail = '';
    if (topLevel.length) {
      var shown = topLevel.slice(0, 6);
      var rest = topLevel.length > shown.length ? ' and ' + (topLevel.length - shown.length) + ' more' : '';
      detail = '. Top-level entries: ' + shown.join(', ') + rest;
    }
    return head + ' with ' + counts + detail + '.';
  }

  // ---------- verbose describers ----------
  // The brief describers above produce a one-paragraph aria-label suitable
  // for screen-reader announcement of the entire diagram in one swoop. The
  // verbose variants below produce a structured walk-through that also lists
  // every member, port, transition, commit, etc. — designed for rendering
  // inside a screen-reader-only block next to the figure. Result
  // shape: { summary: string, sections: [{ heading, items: [string] }] }.

  function describeClassDiagramVerbose(spec) {
    var classes = [], abstracts = [], interfaces = [];
    var members = Object.create(null); // name -> { attributes: [], operations: [] }
    var relationships = [];

    function memberSlot(name) {
      if (!members[name]) members[name] = { attributes: [], operations: [] };
      return members[name];
    }

    // Single line-by-line walk. We track brace depth so an outer class body
    // can contain `{abstract}`, `{static}`, etc. without confusing the
    // matcher (a regex that uses `[^{}]*` for the body fails on those).
    var arrowAlt = CLASS_ARROWS.map(escapeRegex).join('|');
    var relRe = new RegExp(
      '^(\\w+)\\s*(?:["\']([^"\']*)["\']\\s+)?(' + arrowAlt + ')\\s+(?:["\']([^"\']*)["\']\\s+)?(\\w+)\\s*(?::\\s*(.+))?$'
    );

    var depth = 0;
    var currentClass = null;
    var currentBody = [];
    spec.split('\n').forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;

      if (depth === 0) {
        var m;
        var declMatch = line.match(/^(abstract\s+class|class|interface)\s+(\w+)\s*(\{?)\s*$/);
        if (declMatch) {
          var kind = declMatch[1].toLowerCase();
          var name = declMatch[2];
          if (kind === 'abstract class' && abstracts.indexOf(name) < 0) abstracts.push(name);
          else if (kind === 'class' && classes.indexOf(name) < 0) classes.push(name);
          else if (kind === 'interface' && interfaces.indexOf(name) < 0) interfaces.push(name);
          memberSlot(name);
          if (declMatch[3] === '{') {
            depth = 1;
            currentClass = name;
            currentBody = [];
          }
          return;
        }
        if ((m = line.match(relRe))) {
          relationships.push({
            from: m[1], fromMult: m[2], arrow: m[3],
            toMult: m[4], to: m[5], label: m[6] && m[6].trim()
          });
          return;
        }
        return;
      }

      // Inside a class body: count braces to handle `{abstract}` etc.
      var openCount = (line.match(/\{/g) || []).length;
      var closeCount = (line.match(/\}/g) || []).length;
      var endsBlock = false;
      if (closeCount > openCount && depth + openCount - closeCount === 0) {
        endsBlock = true;
        // Strip the trailing class-closing brace (the rest belongs to the body).
        line = line.replace(/\}\s*$/, '').trim();
      }
      depth += openCount - closeCount;
      if (line) currentBody.push(line);
      if (endsBlock || depth <= 0) {
        parseClassBody(currentClass, currentBody.join('\n'), memberSlot);
        depth = 0;
        currentClass = null;
        currentBody = [];
      }
    });

    var summary = describeClassDiagram(stripDecorations(spec));
    var sections = [];

    function sectionForType(label, names) {
      if (!names.length) return;
      var items = names.map(function (n) {
        var slot = members[n] || { attributes: [], operations: [] };
        var lines = [n];
        if (slot.attributes.length) {
          lines.push('Attributes: ' + slot.attributes.join('; '));
        } else {
          lines.push('Attributes: none declared');
        }
        if (slot.operations.length) {
          lines.push('Operations: ' + slot.operations.join('; '));
        } else {
          lines.push('Operations: none declared');
        }
        return lines.join(' — ');
      });
      sections.push({ heading: label, items: items });
    }

    sectionForType('Classes', classes);
    sectionForType('Abstract classes', abstracts);
    sectionForType('Interfaces', interfaces);

    if (relationships.length) {
      var relItems = relationships.map(describeClassRel).filter(Boolean);
      if (relItems.length) sections.push({ heading: 'Relationships', items: relItems });
    }

    return { summary: summary, sections: sections };
  }

  // Parse a class body: each non-empty line is an attribute or operation.
  // Visibility prefix (+, -, #, ~) and modifiers ({abstract}, {static}) are
  // expanded into words.
  function parseClassBody(className, body, slotFn) {
    var slot = slotFn(className);
    body.split('\n').forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      // Drop separator lines (e.g. `--`, `..`).
      if (/^[-.]{2,}$/.test(line)) return;

      var prefix = '';
      var visMap = { '+': 'public', '-': 'private', '#': 'protected', '~': 'package' };
      var first = line.charAt(0);
      if (visMap[first]) {
        prefix = visMap[first] + ' ';
        line = line.slice(1).trim();
      }

      // Extract trailing modifiers like {abstract}, {static}.
      var modifiers = [];
      line = line.replace(/\{([^{}]+)\}/g, function (_, kw) {
        modifiers.push(kw.trim());
        return '';
      }).trim();

      if (!line) return;
      var modSuffix = modifiers.length ? ' (' + modifiers.join(', ') + ')' : '';

      // Operations include parentheses; attributes don't.
      if (line.indexOf('(') >= 0) {
        slot.operations.push(prefix + line + modSuffix);
      } else {
        slot.attributes.push(prefix + line + modSuffix);
      }
    });
  }

  function describeSequenceDiagramVerbose(spec) {
    var parsed = parseSequenceSpec(spec);
    var participants = parsed.participants;
    var messages = parsed.messages;

    var summary = describeSequenceDiagram(stripDecorations(spec));
    var sections = [];

    if (participants.length) {
      sections.push({ heading: 'Participants', items: participants });
    }

    // Surface combined fragments separately so a screen-reader user can
    // enumerate the control-flow blocks (alt branches, loops, parallels …)
    // before walking the message list.
    var fragmentItems = [];
    var seenFragments = Object.create(null);
    messages.forEach(function (m) {
      m.fragmentPath.forEach(function (f) {
        // Equal guards can belong to separate source constructs.
        var key = fragmentSignature([f]);
        if (!seenFragments[key]) {
          seenFragments[key] = true;
          fragmentItems.push(fragmentLabel(f.kind, f.label));
        }
      });
    });
    if (fragmentItems.length) {
      sections.push({ heading: 'Combined fragments', items: fragmentItems });
    }

    if (messages.length) {
      var prevSig = '';
      var msgItems = messages.map(function (m, i) {
        var body = describeSequenceMessage(m);
        var sig = fragmentSignature(m.fragmentPath);
        var line = body;
        if (sig !== prevSig) {
          prevSig = sig;
          var prefix = fragmentPrefix(m.fragmentPath);
          if (prefix) line = prefix + ', ' + body;
          else line = 'outside combined fragments, ' + body;
        }
        return (i + 1) + '. ' + line;
      });
      sections.push({ heading: 'Messages', items: msgItems });
    }

    return { summary: summary, sections: sections };
  }

  function describeStateDiagramVerbose(spec) {
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

    var summary = describeStateDiagram(stripDecorations(spec));
    var sections = [];

    if (states.length) sections.push({ heading: 'States', items: states });
    if (transitions.length) {
      var ts = transitions.map(function (t) {
        var from = t.from === '[*]' ? 'the initial pseudostate' : t.from;
        var to   = t.to   === '[*]' ? 'the final state'        : t.to;
        var tail = t.label ? ' on ' + t.label : '';
        return from + ' transitions to ' + to + tail;
      });
      sections.push({ heading: 'Transitions', items: ts });
    }
    return { summary: summary, sections: sections };
  }

  function describeComponentDiagramVerbose(spec) {
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
        ensure(m[1]);
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

    var summary = describeComponentDiagram(stripDecorations(spec));
    var sections = [];

    if (components.length) {
      var compItems = components.map(function (c) {
        var h = info[c] || { provides: [], requires: [], in: [], out: [] };
        var bits = [];
        if (h.provides.length) bits.push('provides ' + h.provides.join(', '));
        if (h.requires.length) bits.push('requires ' + h.requires.join(', '));
        if (h.in.length)       bits.push('incoming ports ' + h.in.join(', '));
        if (h.out.length)      bits.push('outgoing ports ' + h.out.join(', '));
        return bits.length ? c + ' — ' + bits.join('; ') : c;
      });
      sections.push({ heading: 'Components', items: compItems });
    }

    if (connections.length) {
      var connItems = connections.map(function (c) {
        var verb;
        switch (c.arrow) {
          case '..>': verb = 'depends on'; break;
          case '-->': verb = 'connects to'; break;
          default:    verb = 'is associated with';
        }
        var label = c.label ? ' labeled "' + c.label + '"' : '';
        return c.from + ' ' + verb + ' ' + c.to + label;
      });
      sections.push({ heading: 'Connections', items: connItems });
    }

    return { summary: summary, sections: sections };
  }

  function describeUsecaseDiagramVerbose(spec) {
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

    var summary = describeUsecaseDiagram(stripDecorations(spec));
    var sections = [];

    if (actors.length)   sections.push({ heading: 'Actors',    items: actors });
    if (usecases.length) sections.push({ heading: 'Use cases', items: usecases });

    if (relationships.length) {
      var rels = relationships.map(function (r) {
        function name(id) { return aliasMap[id] ? '"' + aliasMap[id] + '"' : id; }
        if (r.label && /<<\s*include\s*>>/i.test(r.label)) return name(r.from) + ' includes ' + name(r.to);
        if (r.label && /<<\s*extend\s*>>/i.test(r.label))  return name(r.from) + ' extends '  + name(r.to);
        if (r.arrow === '--|>')                            return name(r.from) + ' specializes ' + name(r.to);
        return name(r.from) + ' associates with ' + name(r.to);
      });
      sections.push({ heading: 'Relationships', items: rels });
    }

    return { summary: summary, sections: sections };
  }

  function describeActivityDiagramVerbose(spec) {
    var nodes = [];
    var seen = Object.create(null);
    var re = /^\s*:([^;|\n]+);/gm;
    var m;
    while ((m = re.exec(spec))) {
      var n = m[1].trim();
      if (!seen[n]) { seen[n] = true; nodes.push(n); }
    }
    var summary = describeActivityDiagram(stripDecorations(spec));
    var sections = [];
    if (nodes.length) {
      sections.push({
        heading: 'Activities',
        items: nodes.map(function (n, i) { return (i + 1) + '. ' + n; })
      });
    }
    return { summary: summary, sections: sections };
  }

  function describeDeploymentDiagramVerbose(spec) {
    var parsed = parseDeploymentDescription(spec);
    var sections = [];
    ['node', 'artifact', 'component'].forEach(function(kind) {
      var items = parsed.elements.filter(function(element) { return element.kind === kind; }).map(function(element) {
        var description = element.label + (element.stereotype ? ' (' + element.stereotype + ')' : '');
        if (element.parentId && parsed.byId[element.parentId]) description += ' inside ' + parsed.byId[element.parentId].label;
        var children = parsed.elements.filter(function(child) { return child.parentId === element.id; });
        if (children.length) description += ' contains ' + children.map(function(child) { return child.kind + ' ' + child.label; }).join(' and ');
        return description;
      });
      if (items.length) sections.push({ heading: kind.charAt(0).toUpperCase() + kind.slice(1) + 's', items: items });
    });
    if (parsed.links.length) sections.push({ heading: 'Relationships', items: parsed.links.map(function(link) {
      var phrase = link.arrow === '..>' ? ' depends on ' : link.arrow === '-->' ? ' has a directed communication path to ' : ' has a communication path with ';
      return parsed.byId[link.from].label + phrase + parsed.byId[link.to].label +
        (link.dashed && link.arrow !== '..>' ? ' (dashed)' : '') + (link.label ? ': ' + link.label : '') + '.';
    }) });
    return { summary: deploymentSummary(parsed), sections: sections };
  }

  function describeGitgraphDiagramVerbose(spec) {
    var branches = [];
    var byName = Object.create(null);
    var head = null;
    var current = null;

    spec.split('\n').forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      var m;
      if ((m = line.match(/^branch\s+(\w[\w./-]*)\s*(?:from\s+(\w+))?\s*:/i))) {
        var br = { name: m[1], from: m[2] || null, commits: [] };
        if (!byName[br.name]) {
          branches.push(br);
          byName[br.name] = br;
        }
        current = byName[br.name];
      } else if ((m = line.match(/^head\s+(\w[\w./-]*)/i))) {
        head = m[1];
      } else if (current && (m = line.match(/^(\S+)\s*"([^"]*)"/))) {
        current.commits.push({ id: m[1], msg: m[2] });
      }
    });

    var summary = describeGitgraphDiagram(stripDecorations(spec));
    var sections = [];

    if (branches.length) {
      var brItems = branches.map(function (b) {
        var label = b.name + ' (' + pluralize(b.commits.length, 'commit', 'commits');
        if (b.from) label += ', branched from ' + b.from;
        label += ')';
        return label;
      });
      sections.push({ heading: 'Branches', items: brItems });

      branches.forEach(function (b) {
        if (!b.commits.length) return;
        var commitItems = b.commits.map(function (c) {
          return c.id + ' — ' + (c.msg || '(no message)');
        });
        sections.push({ heading: 'Commits on ' + b.name, items: commitItems });
      });
    }

    if (head) sections.push({ heading: 'HEAD', items: ['HEAD points to ' + head] });

    return { summary: summary, sections: sections };
  }

  function describeFolderTreeDiagramVerbose(spec) {
    var lines = spec.split('\n');
    var indentUnit = 0;
    var nonEmpty = [];
    lines.forEach(function (raw) {
      if (!raw.trim()) return;
      nonEmpty.push(raw);
      if (!indentUnit) {
        var lead = raw.match(/^(\s*)/)[1].length;
        if (lead > 0) indentUnit = lead;
      }
    });

    var entries = [];
    nonEmpty.forEach(function (raw) {
      var lead = raw.match(/^(\s*)/)[1].length;
      var depth = indentUnit > 0 ? Math.floor(lead / indentUnit) : 0;
      var name = raw.trim()
        .replace(/\s+(?:←|<-|#|\/\/)\s+.*$/, '')
        .replace(/\s+#[\w]+(?:\s+\w+)?$/, '')
        .trim();
      if (!name) return;
      var indent = '';
      for (var i = 0; i < depth; i++) indent += ' ';
      var kind = /\/$/.test(name) ? 'folder' : 'file';
      entries.push(indent + name + ' (' + kind + ')');
    });

    var summary = describeFolderTreeDiagram(stripDecorations(spec));
    var sections = [];
    if (entries.length) sections.push({ heading: 'Entries', items: entries });
    return { summary: summary, sections: sections };
  }

  // ---------- CRC cards ----------

  // Keep the standalone Node describer independent of the browser renderer.
  // CRC members are entire lines: braces and colons inside prose are literal.
  function describeCRCCardsVerbose(spec) {
    var sections = [];
    var current = null;
    var inLayout = false;
    String(spec || '').split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line || /^(?:\/\/|#|')/.test(line)) return;
      if (/^@layout\b/i.test(line)) { inLayout = true; return; }
      if (/^@endlayout\b/i.test(line)) { inLayout = false; return; }
      if (inLayout) return;
      if (!current) {
        var declaration = line.match(/^card\s+("(?:[^"\\]|\\.)*"|[^\s{}]+)(?:\s+as\s+(?:"(?:[^"\\]|\\.)*"|[^\s{}]+))?(?:\s+@pos\([^)]*\))?\s*\{\s*$/i);
        if (!declaration) return;
        var name = declaration[1];
        if (name.charAt(0) === '"') name = name.slice(1, -1).replace(/\\(["\\])/g, '$1');
        current = { name: name, responsibilities: [], collaborators: [] };
        return;
      }
      var member = line.match(/^(responsibility|collaborator)\s*:\s*(.+)$/i);
      if (member) {
        current[member[1].toLowerCase() === 'responsibility' ? 'responsibilities' : 'collaborators'].push(member[2]);
      } else if (line === '}') {
        sections.push({
          heading: current.name,
          items: [
            'Responsibilities: ' + (current.responsibilities.join('; ') || 'none declared'),
            'Collaborators: ' + (current.collaborators.join('; ') || 'none declared')
          ]
        });
        current = null;
      }
    });
    var summary = pluralize(sections.length, 'CRC card', 'CRC cards');
    if (sections.length) summary += ': ' + sections.map(function (section) { return section.heading; }).join(', ');
    return { summary: summary + '.', sections: sections };
  }

  // ---------- dispatch ----------

  // The build-time describer also runs without a DOM or the renderer bundle.
  // Keep explanations separate from the UML model in both text alternatives.
  function extractNotationExplanations(spec) {
    const explanations = [];
    let inNote = false;
    const source = String(spec || '').split('\n').map(line => {
      const trimmed = line.trim();
      if (/^end\s*note$/i.test(trimmed)) { inNote = false; return line; }
      if (inNote) return line;
      if (/^note\b[^:]*$/i.test(trimmed)) { inNote = true; return line; }
      const match = trimmed.match(/^callout\s+(?:left|right|top|bottom)\s+of\s+(text\s+"(?:[^"\\]|\\.)+"(?:\s+occurrence\s+\d+)?|(?:element|edge|point|shape)\s+[^\n]+?)\s+:\s+(.+)$/);
      if (!match) return line;
      explanations.push(match[1] + ': ' + match[2]);
      return '';
    }).join('\n');
    return { source, explanations };
  }

  function describe(type, spec) {
    const annotations = extractNotationExplanations(spec);
    const summary = describeModel(type, annotations.source);
    const warnings = inferenceWarnings(type, spec);
    return summary + (warnings.length ? ' ' + warnings.join(' ') : '') +
      (annotations.explanations.length ? ' Notation callouts: ' + annotations.explanations.join(' ') : '');
  }

  function inferenceWarnings(type, spec) {
    if (String(type).toLowerCase() !== 'sequence') return [];
    const notes = String(spec || '').matchAll(/^\s*note\b[^\n]*\n([\s\S]*?)^\s*end\s*note\s*$/gim);
    return [...notes].map(note => note[1].replace(/\s+/g, ' ').trim())
      .filter(note => note.startsWith('Warning: partial sequence inference.'));
  }

  function describeModel(type, spec) {
    var t = String(type || '').toLowerCase();
    var s = stripDecorations(spec);
    try {
      switch (t) {
        case 'class':       return describeClassDiagram(s);
        case 'sequence':    return describeSequenceDiagram(s);
        case 'state':       return describeStateDiagram(s);
        case 'component':   return describeComponentDiagram(s);
        case 'usecase':     return describeUsecaseDiagram(s);
        case 'activity':    return describeActivityDiagram(s);
        case 'deployment':  return describeDeploymentDiagram(s);
        case 'gitgraph':    return describeGitgraphDiagram(s);
        case 'folder-tree': return describeFolderTreeDiagram(s);
        case 'crc':         return describeCRCCardsVerbose(spec).summary;
        default:            return fallbackCaption(type) + '.';
      }
    } catch (e) {
      if (window.console && console.warn) console.warn('UMLAutoDescribe failed:', e);
      return fallbackCaption(type) + '.';
    }
  }

  // Verbose: returns { summary, sections: [{ heading, items: [string] }] }.
  // Note: verbose describers do NOT pre-strip decorations because they want
  // to walk the raw spec themselves (class bodies in particular).
  function describeVerbose(type, spec) {
    const annotations = extractNotationExplanations(spec);
    const verbose = describeModelVerbose(type, annotations.source);
    const warnings = inferenceWarnings(type, spec);
    if (warnings.length) {
      verbose.summary += ' ' + warnings.join(' ');
      verbose.sections.unshift({ heading: 'Inference warnings', items: warnings });
    }
    if (annotations.explanations.length) verbose.sections.push({ heading: 'Notation callouts', items: annotations.explanations });
    return verbose;
  }

  function describeModelVerbose(type, spec) {
    var t = String(type || '').toLowerCase();
    var s = String(spec || '');
    try {
      switch (t) {
        case 'class':       return describeClassDiagramVerbose(s);
        case 'sequence':    return describeSequenceDiagramVerbose(s);
        case 'state':       return describeStateDiagramVerbose(s);
        case 'component':   return describeComponentDiagramVerbose(s);
        case 'usecase':     return describeUsecaseDiagramVerbose(s);
        case 'activity':    return describeActivityDiagramVerbose(s);
        case 'deployment':  return describeDeploymentDiagramVerbose(s);
        case 'gitgraph':    return describeGitgraphDiagramVerbose(s);
        case 'folder-tree': return describeFolderTreeDiagramVerbose(s);
        case 'crc':         return describeCRCCardsVerbose(s);
        default:            return { summary: fallbackCaption(type) + '.', sections: [] };
      }
    } catch (e) {
      if (window.console && console.warn) console.warn('UMLAutoDescribe verbose failed:', e);
      return { summary: describe(type, spec), sections: [] };
    }
  }

  // ---------- HTML rendering for the screen-reader-only verbose description ----------

  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeTypeClass(type) {
    return String(type || '').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  }

  function buildVerboseDescriptionHTML(verbose, type) {
    if (!verbose || !verbose.sections || !verbose.sections.length) return '';
    var safe = safeTypeClass(type);
    var parts = verbose.sections.map(function (section) {
      var heading = escapeHTML(section.heading);
      var items = (section.items || []).map(function (item) {
        return '<li>' + escapeHTML(item) + '</li>';
      }).join('');
      // Use a paragraph rather than a heading element: the verbose text appears
      // under a <figure> on pages where the surrounding outline can be h1/h2/h3
      // already, and a fixed-level heading here would skip levels (WCAG 2.4.6)
      // on flashcards or other shallow contexts.
      return '<section><p class="sebook-figure__verbose-heading">' + heading + '</p><ul>' + items + '</ul></section>';
    }).join('');
    var intro = verbose.summary
      ? '<p>' + escapeHTML(verbose.summary) + '</p>'
      : '';
    return '<div class="sebook-figure__verbose sebook-figure__verbose--' + safe + '" data-uml-verbose="true">' +
           '<p class="sebook-figure__verbose-title">Detailed description</p>' +
           '<div class="sebook-figure__verbose-body">' + intro + parts + '</div>' +
           '</div>';
  }

  // Inject (or replace) a screen-reader-only verbose breakdown next to a
  // rendered figure. `target` is either the <figure> wrapper (preferred — we
  // append inside it) or any element whose parent is the figure (we ascend).
  // No-op when there's no verbose payload to expose.
  function attachVerboseDescription(target, type, spec) {
    if (!target) return;
    var verbose;
    try { verbose = describeVerbose(type, spec); } catch (_) { return; }
    var html = buildVerboseDescriptionHTML(verbose, type);
    if (!html) return;

    var host = target;
    while (host && host.tagName && host.tagName.toLowerCase() !== 'figure') {
      host = host.parentElement;
    }
    if (!host) host = target.parentElement || target;

    // Replace any prior auto-injected verbose block so we don't pile up duplicates
    // when a live diagram is re-rendered (tutorial step changes, etc.).
    var existing = host.querySelector(':scope > [data-uml-verbose="true"]');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    var node = tmp.firstChild;
    if (node) host.appendChild(node);
  }

  // Apply description to a container element (and any inner SVG it contains).
  function applyDescription(el, type, spec) {
    if (!el) return;
    var desc = describe(type, spec);
    if (!desc) return;
    var svg = el.tagName && el.tagName.toLowerCase() === 'svg' ? el : (el.querySelector && el.querySelector('svg'));
    if (svg) {
      var containerOwnsImageRole = el !== svg && el.getAttribute && el.getAttribute('role') === 'img';
      if (containerOwnsImageRole) {
        el.setAttribute('aria-label', desc);
        svg.removeAttribute('role');
        svg.removeAttribute('aria-label');
        svg.removeAttribute('aria-labelledby');
        svg.removeAttribute('aria-describedby');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
      } else {
        svg.removeAttribute('aria-hidden');
        svg.removeAttribute('focusable');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', desc);
      }
      var title = null;
      for (var i = 0; i < svg.childNodes.length; i++) {
        var child = svg.childNodes[i];
        if (child.nodeType === 1 && child.tagName && child.tagName.toLowerCase() === 'title') {
          title = child;
          break;
        }
      }
      if (!title) {
        title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        svg.insertBefore(title, svg.firstChild);
      }
      title.textContent = desc;
    }
    try { attachVerboseDescription(el, type, spec); } catch (_) { /* leave bundle's output */ }
  }

  // The bundle has two render paths and they don't share an aria hook:
  //   1. UMLShared.renderAll() — used by SEBook pages, popouts, SE Gym. It
  //      walks the DOM, calls a closure-scoped createArchUmlFigure() to wrap
  //      each match in <figure>, sets aria-label from the spec's `caption:`
  //      line or a hardcoded fallback ("UML class diagram"), and replaces
  //      the original element with the figure. createArchUmlFigure is not
  //      exported, so we can't patch it directly — we wrap renderAll and do
  //      a snapshot/replay around it.
  //   2. UMLShared.applySvgAccessibility(el, type, syntax) — used by the
  //      live tutorial render path (js/tutorial-code.js calls it after each
  //      re-render). We monkey-patch it directly.
  // Both patches are needed; either alone leaves half the diagrams labeled
  // with the bundle's bare type fallback.

  // The fenced-code-block selectors the bundle uses (mirrored verbatim so
  // we capture the same elements before they're replaced).
  var DIAGRAM_SELECTORS = {
    'class':       'pre > code.language-uml-class',
    'sequence':    'pre > code.language-uml-sequence',
    'state':       'pre > code.language-uml-state',
    'component':   'pre > code.language-uml-component',
    'deployment':  'pre > code.language-uml-deployment',
    'usecase':     'pre > code.language-uml-usecase',
    'activity':    'pre > code.language-uml-activity',
    'freeform':    'pre > code.diagram-freeform, pre > code.language-freeform',
    'gitgraph':    'pre > code.diagram-gitgraph, pre > code.language-gitgraph',
    'folder-tree': 'pre > code.diagram-folder-tree, pre > code.language-folder-tree',
    'venn':        'pre > code.diagram-venn, pre > code.language-venn',
    'er':          'pre > code.diagram-er, pre > code.language-er',
    'crc':         'pre > code.diagram-crc, pre > code.language-crc'
  };

  // Snapshot every diagram about to be rendered. Tracks parent + child index
  // because the bundle's createArchUmlFigure replaces each match with the
  // figure at the same DOM position (replaceChild preserves position).
  function collectSnapshots() {
    var snapshots = [];

    // Path A: <div data-uml-type="…" data-uml-spec="…">
    var divs = document.querySelectorAll('[data-uml-type]');
    for (var i = 0; i < divs.length; i++) {
      var el = divs[i];
      if (el.dataset && el.dataset.umlRendered) continue;
      var type = el.getAttribute('data-uml-type');
      var spec = el.getAttribute('data-uml-spec');
      if (!type || !spec) continue;
      var parent = el.parentElement;
      if (!parent) continue;
      snapshots.push({
        parent: parent,
        idx: Array.prototype.indexOf.call(parent.children, el),
        type: type,
        spec: spec
      });
    }

    // Path B: <pre><code class="language-uml-X">…</code></pre>
    Object.keys(DIAGRAM_SELECTORS).forEach(function (type) {
      var codes = document.querySelectorAll(DIAGRAM_SELECTORS[type]);
      for (var j = 0; j < codes.length; j++) {
        var codeEl = codes[j];
        var pre = codeEl.parentElement;
        if (!pre || (pre.dataset && pre.dataset.umlRendered)) continue;
        var preParent = pre.parentElement;
        if (!preParent) continue;
        snapshots.push({
          parent: preParent,
          idx: Array.prototype.indexOf.call(preParent.children, pre),
          type: type,
          spec: codeEl.textContent
        });
      }
    });

    return snapshots;
  }

  // After the bundle's renderAll has run, each snapshot's original element
  // has been replaced — at the same DOM position — with a <figure>. Find
  // it, override its aria-label with our verbal description, and drop the
  // bundle's auto-fallback figcaption so it stops cluttering the page.
  function applySnapshots(snapshots) {
    for (var i = 0; i < snapshots.length; i++) {
      var s = snapshots[i];
      var slot = s.parent && s.parent.children && s.parent.children[s.idx];
      if (!slot || !slot.classList || !slot.classList.contains('sebook-figure')) continue;

      var desc = describe(s.type, s.spec);
      if (!desc) continue;

      var container = slot.querySelector('[role="img"]');
      if (container) container.setAttribute('aria-label', desc);

      // Drop the bundle's bare-type-label "UML class diagram" figcaption.
      // CSS in css/uml-diagram.css also hides .sebook-figure__caption--auto
      // as a backstop; removing the node here keeps screen readers /
      // print-stylesheet pipelines from announcing it either.
      var autoCap = slot.querySelector('.sebook-figure__caption--auto');
      if (autoCap && autoCap.parentNode) autoCap.parentNode.removeChild(autoCap);

      // Screen-reader-only verbose description. Same markup the Ruby plugin
      // emits for static diagrams, so live + static behave identically.
      try { attachVerboseDescription(slot, s.type, s.spec); } catch (_) { /* leave bundle output */ }
    }
  }

  function patchApplySvgAccessibility() {
    if (!window.UMLShared) return false;
    if (window.UMLShared.__umlAutoDescribeAccessibilityPatched) return true;
    var orig = window.UMLShared.applySvgAccessibility;
    if (typeof orig !== 'function') return false;
    window.UMLShared.applySvgAccessibility = function (el, type, syntax) {
      try { orig.call(this, el, type, syntax); } catch (_) { /* keep going */ }
      try { applyDescription(el, type, syntax); } catch (_) { /* leave bundle's label */ }
    };
    window.UMLShared.__umlAutoDescribeAccessibilityPatched = true;
    return true;
  }

  function patchRenderAll() {
    if (!window.UMLShared) return false;
    if (window.UMLShared.__umlAutoDescribeRenderAllPatched) return true;
    var orig = window.UMLShared.renderAll;
    if (typeof orig !== 'function') return false;
    window.UMLShared.renderAll = function () {
      var snapshots;
      try { snapshots = collectSnapshots(); } catch (_) { snapshots = []; }
      var result = orig.apply(this, arguments);
      try { applySnapshots(snapshots); } catch (_) { /* leave bundle's labels */ }
      return result;
    };
    window.UMLShared.__umlAutoDescribeRenderAllPatched = true;
    return true;
  }

  function tryPatch() {
    var a = patchRenderAll();
    var b = patchApplySvgAccessibility();
    return a && b;
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
  window.UMLAutoDescribe = {
    describe: describe,
    describeVerbose: describeVerbose,
    apply: applyDescription
  };
})();
