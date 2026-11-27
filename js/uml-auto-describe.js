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

  // Manual positions (`@layout` blocks, inline `@pos(x, y)`) say where
  // elements are drawn, not what the model contains.
  function stripLayoutAnnotations(text) {
    return String(text || '')
      .replace(/^\s*@layout\b[^\n]*\n[\s\S]*?^\s*@endlayout[^\n]*$/gim, '')
      .replace(/\s+@pos\([^)]*\)/g, '');
  }

  // ---------- stereotypes ----------
  //
  // `<<A, B>>` and `<<A>> <<B>>` both apply stereotypes A and B; the
  // renderers show them as one «A, B» pair, spelled as written.

  // A list with a colon is one keyword whose text has commas, such as a C4
  // type line (`<<Container: TypeScript, React>>`); the renderer draws it as
  // written either way.
  function addStereotypeNames(names, list) {
    var text = String(list || '');
    (text.indexOf(':') !== -1 ? [text] : text.split(',')).forEach(function (part) {
      var name = part.trim();
      var lower = name.toLowerCase();
      if (name && !names.some(function (known) { return known.toLowerCase() === lower; })) names.push(name);
    });
  }

  // The stereotypes outside quoted text, and the text without them.
  function extractStereotypes(text) {
    var names = [];
    var stripped = String(text || '').replace(/("(?:[^"\\]|\\.)*")|\s*<<([^<>]*)>>/g, function (match, quoted, list) {
      if (quoted) return quoted;
      addStereotypeNames(names, list);
      return '';
    });
    return { names: names, stripped: stripped };
  }

  function indefiniteArticle(word) {
    var lower = String(word || '').toLowerCase();
    if (/^u[^aeiou][aeiouy]/.test(lower)) return 'a'; // user, unit, utility
    return /^[aeiou]/.test(lower) ? 'an' : 'a';
  }

  // ", a service" or ", with stereotypes Service and External".
  function stereotypePhrase(names) {
    if (!names || !names.length) return '';
    if (names.length === 1) return ', ' + indefiniteArticle(names[0]) + ' ' + names[0];
    var list = names.length === 2
      ? names[0] + ' and ' + names[1]
      : names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
    return ', with stereotypes ' + list;
  }

  // Free text such as a connector label shows `<<x>>` as the renderers
  // draw it: adjacent groups merge into one «…» pair.
  function formatStereotypeLabels(text) {
    return String(text || '').replace(/<<[^<>]*>>(?:\s*<<[^<>]*>>)*/g, function (run) {
      var names = [];
      run.replace(/<<([^<>]*)>>/g, function (_, list) { addStereotypeNames(names, list); return ''; });
      return names.length ? '\u00AB' + names.join(', ') + '\u00BB' : '';
    });
  }

  // A trailing `#color [texture]` or texture, optionally before a block's
  // `{`, as the renderers strip it (UMLShared.parseHighlightColor).
  var STYLE_COLOR_SUFFIX = /\s(#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3}|[A-Za-z][A-Za-z0-9]*))(?:\s+(?:hatched|crosshatch|dotted|grid|striped))?(\s*\{?\s*)$/i;
  var STYLE_TEXTURE_SUFFIX = /\s(?:hatched|crosshatch|dotted|grid|striped)(\s*\{?\s*)$/i;

  function stripStyleSuffix(text) {
    var m = text.match(STYLE_COLOR_SUFFIX);
    var tail = m ? m[2] : null;
    if (!m) {
      m = text.match(STYLE_TEXTURE_SUFFIX);
      tail = m ? m[1] : null;
    }
    if (!m) return { text: text, styled: false };
    var head = text.slice(0, text.length - m[0].length);
    return { text: (tail.indexOf('{') !== -1 ? head + ' {' : head).trim(), styled: true };
  }

  // ---------- UML packages ----------

  // Split the text after a block's `{` at top-level `;`, stopping at the
  // brace that closes the block (as the renderers read one-line blocks).
  function splitInlineBlockBody(text) {
    var statements = [], start = 0, depth = 0, quoted = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch === '"' && text.charAt(i - 1) !== '\\') quoted = !quoted;
      if (quoted) continue;
      if (ch === '{') depth++;
      else if (ch === '}' && depth > 0) depth--;
      else if (ch === '}' || (ch === ';' && depth === 0)) {
        statements.push(text.slice(start, i).trim());
        if (ch === '}') return statements.filter(Boolean).concat(['}'], text.slice(i + 1).trim() ? [text.slice(i + 1).trim()] : []);
        start = i + 1;
      }
    }
    statements.push(text.slice(start).trim());
    return statements.filter(Boolean);
  }

  // `package Name {` or `package "Display Name" as Id <<Stereotype>> {`,
  // possibly with the block's statements on the same line.
  function parsePackageLine(line) {
    var m = line.match(/^package\s+(?:"((?:[^"\\]|\\.)*)"|([^\s{"]+))(?:\s+as\s+([^\s{"]+))?([^{]*)\{(.*)$/i);
    if (!m) return null;
    var label = m[1] !== undefined ? m[1].replace(/\\(["\\])/g, '$1') : m[2];
    return { id: m[3] || label, label: label, stereotypes: extractStereotypes(m[4]).names, inlineLines: splitInlineBlockBody(m[5]) };
  }

  function braceBalance(line) {
    var balance = 0, quoted = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      if (ch === '"' && line.charAt(i - 1) !== '\\') quoted = !quoted;
      else if (!quoted && ch === '{') balance++;
      else if (!quoted && ch === '}') balance--;
    }
    return balance;
  }

  // Read `package` blocks out of a source. Returns each package (id, label,
  // stereotypes, parent, and the elements declared directly inside it; the
  // first package an element is declared in wins) and the source without
  // its package lines, so other readers see the contents as top-level
  // statements. `declaredId(line)` names the element a line declares.
  function readPackages(source, declaredId) {
    var packages = [], byId = Object.create(null), memberOf = Object.create(null);
    var stack = [], out = [];
    var lines = String(source || '').split('\n');
    function innermostPackage() {
      for (var s = stack.length - 1; s >= 0; s--) if (stack[s]) return stack[s];
      return null;
    }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      var opener = parsePackageLine(line);
      if (opener) {
        var pkg = byId[opener.id];
        if (!pkg) {
          var parent = innermostPackage();
          pkg = { id: opener.id, label: opener.label, stereotypes: opener.stereotypes, parent: parent ? parent.id : null, members: [] };
          byId[pkg.id] = pkg;
          packages.push(pkg);
        }
        stack.push(pkg);
        Array.prototype.splice.apply(lines, [i + 1, 0].concat(opener.inlineLines));
        continue;
      }
      if (line === '}' && stack.length && stack.pop()) continue;
      var top = stack.length ? stack[stack.length - 1] : null;
      var id = top ? declaredId(line) : null;
      if (id && !memberOf[id]) {
        memberOf[id] = top.id;
        top.members.push(id);
      }
      if (line !== '}') {
        var balance = braceBalance(line);
        for (; balance > 0; balance--) stack.push(null);
        // A body may close at the end of its last line (`+x: int }`).
        for (; balance < 0 && stack.length && !stack[stack.length - 1]; balance++) stack.pop();
      }
      out.push(lines[i]);
    }
    return { source: out.join('\n'), packages: packages, byId: byId };
  }

  function packageTitle(pkg, byId) {
    var parent = pkg.parent && byId[pkg.parent];
    return pkg.label + stereotypePhrase(pkg.stereotypes) + (parent ? ' (in package ' + parent.label + ')' : '');
  }

  // Packages with members, as "Name: A, B" (members named by `labelOf`).
  function packageItems(read, labelOf) {
    return read.packages.filter(function (pkg) { return pkg.members.length; }).map(function (pkg) {
      return packageTitle(pkg, read.byId) + ': ' + pkg.members.map(labelOf).join(', ');
    });
  }

  function packageSentences(read, labelOf) {
    return packageItems(read, labelOf).map(function (item) { return 'In package ' + item + '.'; });
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
      'crc': 'Class-responsibility-collaborator cards',
      'c4': 'C4 model diagram'
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

  var CLASS_DECLARATION = /^(?:abstract\s+class|class|interface|enum)\s+(?:"((?:[^"\\]|\\.)*)"|([^\s{"<]+))(?:\s+as\s+([^\s{"<]+))?/;

  // `package Name` without braces is a package drawn without its members: a
  // node of the class diagram, like a class. (With braces it is the frame
  // around its members, which readPackages reads.)
  var PACKAGE_NODE = /^package\s+(?:"((?:[^"\\]|\\.)*)"|([^\s{"<]+))(?:\s+as\s+([^\s{"<]+))?\s*$/;
  // A name in a relationship, which may be qualified: services::loyalty.
  var CLASS_REL_NAME = '\\w+(?:::\\w+)*';

  function packageNodeOf(line) {
    if (line.indexOf('{') !== -1) return null;
    var stereotypes = extractStereotypes(line);
    var head = stereotypes.stripped.trim();
    var style = stripStyleSuffix(head);
    if (style.styled && /^package\s+\S/.test(style.text)) head = style.text;
    var m = head.match(PACKAGE_NODE);
    if (!m) return null;
    var label = m[1] !== undefined ? m[1].replace(/\\(["\\])/g, '$1') : m[2];
    return { id: m[3] || label, label: label, stereotypes: stereotypes.names };
  }

  function classDeclarationId(line) {
    var m = line.match(CLASS_DECLARATION);
    if (m) return m[3] || m[1] || m[2];
    var node = packageNodeOf(line);
    return node ? node.id : null;
  }

  // "UML package diagram" when packages are all a class diagram draws.
  function classDiagramTitle(packageCount, classifierCount) {
    return packageCount && !classifierCount ? 'UML package diagram' : 'UML class diagram';
  }

  var CLASS_START = /^(?:abstract\s+class|class|interface|enum)\s+\S/;

  // A declaration line without its stereotypes and `#color [texture]`
  // suffix, which may come before or after them, as the renderer reads it.
  function cleanClassDeclaration(line) {
    var brace = line.indexOf('{');
    var head = brace === -1 ? line : line.slice(0, brace).trim();
    var body = brace === -1 ? '' : ' ' + line.slice(brace);
    // `class dotted` names a class; it is not a texture.
    var style = stripStyleSuffix(head);
    if (style.styled && CLASS_START.test(style.text)) head = style.text;
    else style.styled = false;
    var stereotypes = extractStereotypes(head);
    head = stereotypes.stripped.trim();
    if (!style.styled) {
      var afterStereotypes = stripStyleSuffix(head);
      if (CLASS_START.test(afterStereotypes.text)) head = afterStereotypes.text;
    }
    return { line: head + body, stereotypes: stereotypes.names };
  }

  function describeClassDiagram(spec) {
    var read = readPackages(stripLayoutAnnotations(spec), classDeclarationId);
    var bodyStripped = read.source.replace(/\{[^{}]*\}/gm, ''); // drop class bodies

    var classes = [], abstracts = [], interfaces = [], packageNodes = [];
    var relationships = [];
    var packageLabels = Object.create(null); // id -> the name a package node shows
    function shownName(id) { return packageLabels[id] || String(id); }

    var arrowAlt = CLASS_ARROWS.map(escapeRegex).join('|');
    var relRe = new RegExp(
      '^(' + CLASS_REL_NAME + ')\\s*(?:["\']([^"\']*)["\']\\s+)?(' + arrowAlt + ')\\s+(?:["\']([^"\']*)["\']\\s+)?(' + CLASS_REL_NAME + ')\\s*(?::\\s*(.+))?$'
    );

    bodyStripped.split('\n').forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      var m;
      var node = packageNodeOf(line);
      if (node) {
        if (!packageLabels[node.id]) packageNodes.push(node.label);
        packageLabels[node.id] = node.label;
      } else if ((m = line.match(/^abstract\s+class\s+(\w+)/))) {
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

    if (!classes.length && !abstracts.length && !interfaces.length && !packageNodes.length && !relationships.length) {
      return 'UML class diagram.';
    }

    var items = [];
    if (classes.length) items.push(pluralize(classes.length, 'class', 'classes') + ' (' + classes.join(', ') + ')');
    if (abstracts.length) items.push(pluralize(abstracts.length, 'abstract class', 'abstract classes') + ' (' + abstracts.join(', ') + ')');
    if (interfaces.length) items.push(pluralize(interfaces.length, 'interface', 'interfaces') + ' (' + interfaces.join(', ') + ')');
    if (packageNodes.length) items.push(pluralize(packageNodes.length, 'package', 'packages') + ' (' + packageNodes.join(', ') + ')');
    var title = classDiagramTitle(packageNodes.length, classes.length + abstracts.length + interfaces.length);
    var head = items.length ? title + ' with ' + items.join(', ') + '.' : title + '.';
    var packageLines = packageSentences(read, shownName);
    if (packageLines.length) head += ' ' + packageLines.join(' ');

    var rels = relationships.map(function (rel) {
      return describeClassRel({ from: shownName(rel.from), fromMult: rel.fromMult, arrow: rel.arrow,
        toMult: rel.toMult, to: shownName(rel.to), label: rel.label });
    }).filter(Boolean);
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
  // A lifeline id may carry a selector for one element of a collection, such
  // as `sensor[i]` (UML 2.5.1, 17.3.4).
  var SEQ_ID = '\\w+(?:\\[[^\\]]*\\])?';
  var SEQ_DECLARATION = new RegExp('^(?:participant|actor)\\s+(' + SEQ_ID + ')\\s*(?:(?:\\s+as\\s+|:)\\s*(.+))?$', 'i');
  var SEQ_LOST = new RegExp('^(' + SEQ_ID + ')\\s+-{1,2}>o\\s*(?::\\s*(.*))?$');
  var SEQ_MESSAGE = new RegExp('^(' + SEQ_ID + '|o)\\s*(->>|->|-->|<<-|<-|<--)\\s*(' + SEQ_ID + ')\\s*(?::\\s*(.+))?$');
  var SEQ_CREATE = /^(?:<<\s*create\s*>>|«\s*create\s*»)(.*)$/i;

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
      // A trailing `#color [texture]` only highlights an existing lifeline.
      if ((m = line.replace(/\s+#\S+(?:\s+\w+)?$/, '').match(SEQ_DECLARATION))) {
        if (!participantIds[m[1]]) {
          participantIds[m[1]] = true;
          // `as : Cls` is an anonymous instance; name it by its type.
          participants.push((m[2] || '').replace(/^:\s*/, '').trim() || m[1]);
        }
        return;
      }
      // Deep-copy frames so a later `else` that mutates the live stack
      // doesn't retroactively rewrite this message's branch label.
      var frozenPath = stack.map(function (f) { return { id: f.id, kind: f.kind, label: f.label }; });
      if ((m = line.match(SEQ_LOST))) {
        messages.push({ from: m[1], arrow: '->o', to: null, lost: true, text: m[2] && m[2].trim(), fragmentPath: frozenPath });
        return;
      }
      if ((m = line.match(SEQ_MESSAGE))) {
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
        if (id && id !== 'o' && !participantIds[id]) {
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
    var creation = (message.text || '').match(SEQ_CREATE);
    if (creation && !message.lost) {
      var reversed = message.arrow.charAt(0) === '<';
      var args = creation[1].trim();
      return (reversed ? message.to : message.from) + ' creates ' + (reversed ? message.from : message.to) +
        (args ? ' with "' + args + '"' : '');
    }
    var payload = message.text ? ' with "' + message.text + '"' : '';
    if (message.lost) return 'lost message from ' + message.from + payload + ', which never reaches a receiver';
    if (message.from === 'o') return 'found message from outside the diagram to ' + message.to + payload;
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

  // States in order, their composite parents, the behaviors listed inside each
  // state (entry, exit, do, and internal transitions), and the transitions.
  // Layout metadata, positions, and highlight colors carry no meaning here.
  function parseStateSpec(spec) {
    var model = { states: [], parents: Object.create(null), behaviors: Object.create(null), transitions: [] };
    var seen = Object.create(null);
    var stack = [];
    var text = String(spec || '').replace(/^[ \t]*@layout\b[\s\S]*?^[ \t]*@endlayout[ \t]*$/gim, '');

    function record(name, parent) {
      if (name === '[*]' || seen[name]) return;
      seen[name] = true;
      model.states.push(name);
      if (parent) model.parents[name] = parent;
    }
    function behavior(name, row) {
      record(name, stack[stack.length - 1]);
      (model.behaviors[name] = model.behaviors[name] || []).push(row);
    }
    function describeRow(row) {
      return /^(entry|exit|do)\s*\//i.test(row) ? row : 'internal transition ' + row;
    }

    text.split('\n').forEach(function (raw) {
      var line = raw.replace(/\s+@pos\([^)]*\)/i, '').trim();
      var parent = stack[stack.length - 1];
      var m;
      if (!line) return;
      if (line === '}') { stack.pop(); return; }
      if ((m = line.match(/^state\s+(\w+)[^{]*\{\s*$/))) { record(m[1], parent); stack.push(m[1]); return; }
      if ((m = line.match(/^state\s+(\w+)/))) { record(m[1], parent); return; }
      if ((m = line.match(/^(\[\*\]|\w+)\s*-->\s*(\[\*\]|\w+)\s*(?::\s*(.+))?$/))) {
        model.transitions.push({ from: m[1], to: m[2], label: m[3] && m[3].trim(), parent: parent });
        record(m[1], parent); record(m[2], parent);
        return;
      }
      if ((m = line.match(/^(\w+)\s*:\s*(.*\/.*)$/))) { behavior(m[1], describeRow(m[2].trim())); return; }
      if (parent && /\//.test(line) && !/^(?:note|callout)\b/i.test(line)) behavior(parent, describeRow(line));
    });
    return model;
  }

  function stateTransitionSentence(t) {
    var from = t.from === '[*]' ? (t.parent ? 'the initial pseudostate of ' + t.parent : 'the initial pseudostate') : t.from;
    var to   = t.to   === '[*]' ? (t.parent ? 'the final state of ' + t.parent : 'the final state') : t.to;
    var tail = t.label ? ' on ' + t.label : '';
    return from + ' transitions to ' + to + tail;
  }

  function stateCompositeSentences(model) {
    var children = Object.create(null);
    model.states.forEach(function (name) {
      var parent = model.parents[name];
      if (parent) (children[parent] = children[parent] || []).push(name);
    });
    return Object.keys(children).map(function (parent) {
      return parent + ' is a composite state containing ' + children[parent].join(', ');
    });
  }

  function stateBehaviorSentences(model) {
    return model.states.filter(function (name) { return model.behaviors[name]; }).map(function (name) {
      return name + ' lists ' + model.behaviors[name].join('; ');
    });
  }

  function describeStateDiagram(spec) {
    var model = parseStateSpec(spec);
    var states = model.states;
    if (!model.transitions.length && !states.length) return 'UML state machine diagram.';
    var parts = [states.length
      ? 'UML state machine diagram with ' + pluralize(states.length, 'state', 'states') + ' (' + states.join(', ') + ')'
      : 'UML state machine diagram'];
    parts = parts.concat(stateCompositeSentences(model), stateBehaviorSentences(model));
    if (model.transitions.length) parts.push('Transitions: ' + model.transitions.map(stateTransitionSentence).join('; '));
    return parts.join('. ') + '.';
  }

  // ---------- component diagrams ----------

  // Component diagrams, read the way the renderer reads them: declarations
  // with display names, stereotypes, and style suffixes; ports in block or
  // one-line bodies; connectors between components, ports (`alias`,
  // `Comp.port`), or bracketed names; and UML packages.
  var COMPONENT_START = /^(?:component\s+\S|\[[^\]]+\])/i;
  var PORT_STATEMENT = /^(portin|portout|port|provide|require)\s+(?:"([^"]+)"|([^\s"]+?))(?:\s+as\s+(\S+?))?(?:\s+dashed)?$/;
  var INLINE_PORT = /(portin|portout|port|provide|require)\s+(?:"([^"]+)"|(\w+))(?:\s+as\s+(\w+))?/g;
  var COMPONENT_CONNECTION = /^(?:\[([^\]]+)\]|(\S+))\s+(-->|\.\.>|--)\s+(?:\[([^\]]+)\]|(\S+))(?:\s+(dashed))?\s*(?::\s*(.*))?$/;
  var PORT_GROUPS = { portin: 'in', portout: 'out', port: 'ports', provide: 'provides', require: 'requires' };
  // The renderer's stripComponentDashedStyle: a trailing `dashed`, in any case,
  // is the port's line style, unless it is the port's whole name (`port dashed`).
  var TRAILING_DASHED = /\s+dashed\s*$/i;
  var PORT_KEYWORD_ONLY = /^(?:portin|portout|port|provide|require)$/i;

  function matchPortStatement(line) {
    var style = line.match(TRAILING_DASHED);
    var head = style ? line.slice(0, style.index) : line;
    return (style && !PORT_KEYWORD_ONLY.test(head.trim()) ? head : line).match(PORT_STATEMENT);
  }

  // A component declaration as the renderer reads it: a final `dashed`, a
  // `#color [texture]` before or after the stereotypes, then the name, its
  // optional alias, and the `{` of a port block. Returns null otherwise.
  function parseComponentDeclaration(line) {
    var text = line;
    var dashed = text.match(/\s+dashed(\s*\{?\s*)$/i);
    if (dashed) {
      var beforeDashed = text.slice(0, text.length - dashed[0].length);
      // `component dashed` is a component named dashed.
      if (!/^(?:component|portin|portout|port|provide|require)$/i.test(beforeDashed.trim())) {
        text = (dashed[1].indexOf('{') !== -1 ? beforeDashed + ' {' : beforeDashed).trim();
      }
    }
    var style = stripStyleSuffix(text);
    if (!COMPONENT_START.test(style.text)) return null;
    text = style.text;
    var brace = text.indexOf('{');
    var stereotypes = extractStereotypes(brace === -1 ? text : text.slice(0, brace));
    if (stereotypes.names.length) {
      text = (stereotypes.stripped.trim() + (brace === -1 ? '' : ' ' + text.slice(brace))).trim();
      var beforeStereotypes = style.styled ? null : stripStyleSuffix(text);
      if (beforeStereotypes && COMPONENT_START.test(beforeStereotypes.text)) text = beforeStereotypes.text;
    }
    var m = text.match(/^component\s+(?:\[([^\]]+)\]|"([^"]+)"|(\S+))(?:\s+as\s+(\S+))?\s*(\{)?\s*$/) ||
      text.match(/^component\s+(?:\[([^\]]+)\]|"([^"]+)"|(\S+))(?:\s+as\s+(\S+))?\s*(\{)/);
    if (m) {
      var label = m[1] || m[2] || m[3];
      var id = (m[4] || label).replace(/^\[(.*)\]$/, '$1');
      var open = line.indexOf('{');
      return { id: id, label: label, stereotypes: stereotypes.names, body: open === -1 ? null : line.slice(open + 1) };
    }
    // `[Name]` declares a component only as a whole line: `[A] --> [B]`
    // connects two.
    var bracket = text.match(/^\[([^\]]+)\](?:\s+as\s+(\S+))?\s*$/);
    if (!bracket) return null;
    return { id: bracket[2] || bracket[1].trim(), label: bracket[1].trim(), stereotypes: stereotypes.names, body: null };
  }

  function componentDeclarationId(line) {
    var declaration = parseComponentDeclaration(line);
    return declaration ? declaration.id : null;
  }

  function parseComponentDescription(spec) {
    var read = readPackages(stripLayoutAnnotations(stripDecorations(spec)), componentDeclarationId);
    var components = [], byId = Object.create(null);
    var ports = Object.create(null); // component id -> port names by kind, in first-port order
    var portOwner = Object.create(null), standalonePorts = Object.create(null);
    var connections = [];
    var current = null;

    function addPort(owner, keyword, name, alias) {
      if (!ports[owner]) ports[owner] = { in: [], out: [], ports: [], provides: [], requires: [] };
      ports[owner][PORT_GROUPS[keyword]].push(name);
      portOwner[alias || name] = owner;
    }

    function labelOf(token) {
      var id = String(token || '');
      if (portOwner[id]) id = portOwner[id];
      else if (standalonePorts[id] !== undefined) return standalonePorts[id];
      else if (!byId[id] && id.indexOf('.') > 0 && byId[id.slice(0, id.indexOf('.'))]) id = id.slice(0, id.indexOf('.'));
      return byId[id] ? byId[id].label : id;
    }

    read.source.split('\n').forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      var m;
      if (current) {
        if (line === '}') current = null;
        else if ((m = matchPortStatement(line))) addPort(current, m[1], m[2] || m[3], m[4]);
        return;
      }
      var declaration = parseComponentDeclaration(line);
      if (declaration) {
        var id = declaration.id;
        if (!byId[id]) {
          byId[id] = { id: id, label: declaration.label, stereotypes: declaration.stereotypes };
          components.push(byId[id]);
        } else if (declaration.stereotypes.length) {
          byId[id].stereotypes = declaration.stereotypes;
        }
        var body = declaration.body;
        if (body !== null && body.indexOf('}') !== -1) {
          while ((m = INLINE_PORT.exec(body.slice(0, body.indexOf('}'))))) addPort(id, m[1], m[2] || m[3], m[4]);
          INLINE_PORT.lastIndex = 0;
        } else if (body !== null) {
          current = id;
        }
        return;
      }
      if ((m = matchPortStatement(line))) {
        standalonePorts[m[4] || m[2] || m[3]] = m[2] || m[3];
        return;
      }
      if ((m = line.match(COMPONENT_CONNECTION))) {
        connections.push({
          from: m[1] || m[2], arrow: m[3], to: m[4] || m[5], dashed: !!m[6],
          label: m[7] && formatStereotypeLabels(m[7].trim())
        });
      }
    });

    // As in the renderer, a connector end that names no component or port
    // draws a component of its own.
    connections.forEach(function (c) {
      [c.from, c.to].forEach(function (end) {
        var owner = end.indexOf('.') > 0 ? end.slice(0, end.indexOf('.')) : null;
        if (byId[end] || portOwner[end] || standalonePorts[end] !== undefined || (owner && byId[owner])) return;
        byId[end] = { id: end, label: end, stereotypes: [] };
        components.push(byId[end]);
      });
    });
    connections.forEach(function (c) { c.from = labelOf(c.from); c.to = labelOf(c.to); });
    return {
      components: components, ports: ports, connections: connections,
      packages: read, labelOf: function (id) { return byId[id] ? byId[id].label : id; }
    };
  }

  function componentPortPhrases(groups) {
    var parts = [];
    if (!groups) return parts;
    if (groups.provides.length) parts.push('provides ' + groups.provides.join(', '));
    if (groups.requires.length) parts.push('requires ' + groups.requires.join(', '));
    if (groups.in.length)       parts.push('incoming ports ' + groups.in.join(', '));
    if (groups.out.length)      parts.push('outgoing ports ' + groups.out.join(', '));
    if (groups.ports.length)    parts.push('ports ' + groups.ports.join(', '));
    return parts;
  }

  function componentConnectionSentence(c) {
    var verb;
    switch (c.arrow) {
      case '..>': verb = 'depends on'; break;
      case '-->': verb = 'connects to'; break;
      default:    verb = 'is associated with';
    }
    var label = c.label ? ' labeled "' + c.label + '"' : '';
    return c.from + ' ' + verb + ' ' + c.to + (c.dashed ? ' (dashed)' : '') + label;
  }

  function describeComponentDiagram(spec) {
    var model = parseComponentDescription(spec);
    var components = model.components;
    if (!components.length && !model.connections.length) return 'UML component diagram.';

    var stereotyped = components.some(function (c) { return c.stereotypes.length; });
    var names = components.map(function (c) { return c.label + stereotypePhrase(c.stereotypes); });
    var head = components.length
      ? 'UML component diagram with ' + pluralize(components.length, 'component', 'components') + ' (' + names.join(stereotyped ? '; ' : ', ') + ')'
      : 'UML component diagram';

    var portLines = [];
    Object.keys(model.ports).forEach(function (id) {
      var parts = componentPortPhrases(model.ports[id]);
      if (parts.length) portLines.push(model.labelOf(id) + ' ' + parts.join(', '));
    });

    var out = head + '.';
    var packageLines = packageSentences(model.packages, model.labelOf);
    if (packageLines.length) out += ' ' + packageLines.join(' ');
    if (portLines.length) out += ' ' + portLines.join('. ') + '.';
    if (model.connections.length) out += ' Connections: ' + model.connections.map(componentConnectionSentence).join('; ') + '.';
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
    // Every '{' pushes its owner (or the enclosing node for an anonymous
    // block) so a '}' returns to the enclosing node, not the top level.
    var parents = [], pendingParent = null, text = '', quoted = false, escaped = false;
    function currentParent() { return parents.length ? parents[parents.length - 1] : null; }
    function unquote(value) { return String(value || '').replace(/^"|"$/g, '').replace(/\\(["\\])/g, '$1'); }
    function addStatement(statement) {
      var line = statement.trim();
      if (!line) return;
      var match = line.match(/^(node|component|artifact)\s+("(?:\\.|[^"\\])*"|[^\s{}]+)(?:\s+as\s+("(?:\\.|[^"\\])*"|[^\s{}]+))?(?:\s+<<([^>]+)>>)?/i);
      if (match) {
        var id = unquote(match[3] || match[2]);
        var element = { id: id, label: unquote(match[2]), kind: match[1].toLowerCase(), parentId: currentParent(), stereotype: match[4] || '' };
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
        if (ch === '{') { parents.push(pendingParent || currentParent()); pendingParent = null; }
        else if (ch === '}') { parents.pop(); pendingParent = null; }
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
    var read = readPackages(stripLayoutAnnotations(spec), classDeclarationId);
    var classes = [], abstracts = [], interfaces = [], packageNodes = [];
    var members = Object.create(null); // name -> { attributes: [], operations: [] }
    var stereotypes = Object.create(null); // name -> applied stereotypes
    var relationships = [];
    var packageLabels = Object.create(null); // id -> the name a package node shows
    function shownName(id) { return packageLabels[id] || String(id); }

    function memberSlot(name) {
      if (!members[name]) members[name] = { attributes: [], operations: [] };
      return members[name];
    }

    // Single line-by-line walk. We track brace depth so an outer class body
    // can contain `{abstract}`, `{static}`, etc. without confusing the
    // matcher (a regex that uses `[^{}]*` for the body fails on those).
    var arrowAlt = CLASS_ARROWS.map(escapeRegex).join('|');
    var relRe = new RegExp(
      '^(' + CLASS_REL_NAME + ')\\s*(?:["\']([^"\']*)["\']\\s+)?(' + arrowAlt + ')\\s+(?:["\']([^"\']*)["\']\\s+)?(' + CLASS_REL_NAME + ')\\s*(?::\\s*(.+))?$'
    );

    var depth = 0;
    var currentClass = null;
    var currentBody = [];
    read.source.split('\n').forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;

      if (depth === 0) {
        var m;
        var node = packageNodeOf(line);
        if (node) {
          if (!packageLabels[node.id]) packageNodes.push(node);
          packageLabels[node.id] = node.label;
          return;
        }
        var declaration = cleanClassDeclaration(line);
        var declMatch = declaration.line.match(/^(abstract\s+class|class|interface)\s+(\w+)\s*(\{?)\s*$/);
        if (declMatch) {
          var kind = declMatch[1].toLowerCase();
          var name = declMatch[2];
          if (declaration.stereotypes.length) stereotypes[name] = declaration.stereotypes;
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
        var lines = [n + stereotypePhrase(stereotypes[n])];
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
    // Packages drawn as nodes, each with the package that holds it, then the
    // packages that show their members.
    var packages = packageNodes.map(function (node) {
      var holder = read.packages.filter(function (pkg) { return pkg.members.indexOf(node.id) !== -1; })[0];
      return node.label + stereotypePhrase(node.stereotypes) + (holder ? ' (in package ' + holder.label + ')' : '');
    }).concat(packageItems(read, shownName));
    if (packages.length) sections.push({ heading: 'Packages', items: packages });

    if (relationships.length) {
      var relItems = relationships.map(function (rel) {
        return describeClassRel({ from: shownName(rel.from), fromMult: rel.fromMult, arrow: rel.arrow,
          toMult: rel.toMult, to: shownName(rel.to), label: rel.label });
      }).filter(Boolean);
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
    var stripped = stripDecorations(spec);
    var model = parseStateSpec(stripped);
    var sections = [];

    if (model.states.length) {
      sections.push({ heading: 'States', items: model.states.map(function (name) {
        return model.parents[name] ? name + ' (inside ' + model.parents[name] + ')' : name;
      }) });
    }
    var behaviors = stateBehaviorSentences(model);
    if (behaviors.length) sections.push({ heading: 'Behaviors inside states', items: behaviors });
    if (model.transitions.length) {
      sections.push({ heading: 'Transitions', items: model.transitions.map(stateTransitionSentence) });
    }
    return { summary: describeStateDiagram(stripped), sections: sections };
  }

  function describeComponentDiagramVerbose(spec) {
    var model = parseComponentDescription(spec);
    var summary = describeComponentDiagram(stripDecorations(spec));
    var sections = [];

    if (model.components.length) {
      sections.push({ heading: 'Components', items: model.components.map(function (c) {
        var bits = componentPortPhrases(model.ports[c.id]);
        return c.label + stereotypePhrase(c.stereotypes) + (bits.length ? ' — ' + bits.join('; ') : '');
      }) });
    }
    var packages = packageItems(model.packages, model.labelOf);
    if (packages.length) sections.push({ heading: 'Packages', items: packages });
    if (model.connections.length) {
      sections.push({ heading: 'Connections', items: model.connections.map(componentConnectionSentence) });
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
        // Name every enclosing level, innermost first; a cycle cannot occur in
        // parsed source, but a seen-set keeps a malformed model finite.
        var seen = Object.create(null);
        for (var parentId = element.parentId; parentId && parsed.byId[parentId] && !seen[parentId]; parentId = parsed.byId[parentId].parentId) {
          seen[parentId] = true;
          description += ' inside ' + parsed.byId[parentId].label;
        }
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

  // C4 embeds are YAML that only the C4 core reads, so callout lines are not
  // notation there and the text reaches the core untouched (spec §3.3).
  function splitNotationExplanations(type, spec) {
    if (String(type || '').toLowerCase() === 'c4') return { source: String(spec || ''), explanations: [] };
    return extractNotationExplanations(spec);
  }

  // An embed's `# description: …` comment line (column 0, as the C4 renderer
  // reads its directives) is the author's verbose text alternative, for
  // example for a find-the-flaw figure whose generated text would give the
  // answer away.
  function authoredC4Description(spec) {
    var match = /^#[ \t]*description[ \t]*:[ \t]*(.*?)[ \t]*$/im.exec(String(spec || ''));
    return match && match[1] ? match[1] : null;
  }

  // The C4 core describes its own views (spec §6.5). Pages may load it lazily
  // after this script, so it is looked up at call time. The brief label is
  // always the core's; an authored description replaces only the verbose text.
  function describeC4Verbose(spec) {
    var core = window.ArchUMLC4;
    if (!core) return { summary: fallbackCaption('c4') + '.', sections: [] };
    var design = core.load(spec);
    var selector = core.extractEmbed(spec).selector || core.defaultView(design);
    var description = core.describe(core.project(design, selector));
    var authored = authoredC4Description(spec);
    var sections = authored ? [{ heading: 'Description', items: [authored] }] : description.sections;
    return { summary: description.brief, sections: sections };
  }

  function describe(type, spec) {
    const annotations = splitNotationExplanations(type, spec);
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
        case 'c4':          return describeC4Verbose(spec).summary;
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
    const annotations = splitNotationExplanations(type, spec);
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
        case 'c4':          return describeC4Verbose(s);
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

  // A C4 interface card is semantic HTML that is its own text (spec §6.6):
  // it gets no image label and no detailed description repeating it.
  var CARD_SELECTOR = '[data-c4-notation="interface-card"]';

  function isInterfaceCard(el) {
    return Boolean(el && el.matches && el.matches(CARD_SELECTOR));
  }

  // Apply description to a container element (and any inner SVG it contains).
  function applyDescription(el, type, spec) {
    if (!el || isInterfaceCard(el)) return;
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

  // Besides its own auto-init (see describeDrawnFigures), the bundle has two
  // render paths and they don't share an aria hook:
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
    'crc':         'pre > code.diagram-crc, pre > code.language-crc',
    'c4':          'pre > code.diagram-c4, pre > code.language-c4'
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
      describeFigure(slot, s.type, s.spec);
    }
  }

  var describedContainers = typeof WeakSet === 'function' ? new WeakSet() : null;

  // Name one bundle-drawn <figure> by its description.
  function describeFigure(figure, type, spec) {
    // A C4 figure that is still loading or shows an error or empty state is
    // labelled by that state; the stub describes it once it is drawn. An
    // interface card is its own text.
    if (figure.querySelector('[data-c4-state]') || figure.querySelector(CARD_SELECTOR)) return;
    var desc = describe(type, spec);
    if (!desc) return;

    var container = figure.querySelector('[role="img"]');
    if (container) {
      container.setAttribute('aria-label', desc);
      if (describedContainers) describedContainers.add(container);
    }

    // Drop the bundle's bare-type-label "UML class diagram" figcaption.
    // CSS in css/uml-diagram.css also hides .sebook-figure__caption--auto
    // as a backstop; removing the node here keeps screen readers /
    // print-stylesheet pipelines from announcing it either.
    var autoCap = figure.querySelector('.sebook-figure__caption--auto');
    if (autoCap && autoCap.parentNode) autoCap.parentNode.removeChild(autoCap);

    // Screen-reader-only verbose description. Same markup the Ruby plugin
    // emits for static diagrams, so live + static behave identically.
    try { attachVerboseDescription(figure, type, spec); } catch (_) { /* leave bundle output */ }
  }

  // The bundle's own auto-init draws every fenced block already in the page
  // as soon as the bundle runs — for a deferred bundle, before this script
  // has loaded — without calling renderAll or applySvgAccessibility. Those
  // figures are described from the source the bundle recorded for them.
  function describeDrawnFigures() {
    if (!window.UMLShared || typeof window.UMLShared.figureSource !== 'function') return;
    var containers = document.querySelectorAll('figure.sebook-figure--archuml [role="img"][data-uml-rendered]');
    for (var i = 0; i < containers.length; i++) {
      var container = containers[i];
      if (describedContainers && describedContainers.has(container)) continue;
      var source = window.UMLShared.figureSource(container);
      var figure = container.closest('figure');
      if (source && figure) describeFigure(figure, source.type, source.text);
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
      try { describeDrawnFigures(); } catch (_) { /* leave bundle's labels */ }
      return result;
    };
    window.UMLShared.__umlAutoDescribeRenderAllPatched = true;
    return true;
  }

  function tryPatch() {
    var a = patchRenderAll();
    var b = patchApplySvgAccessibility();
    if (a && b) {
      try { describeDrawnFigures(); } catch (_) { /* leave bundle's labels */ }
      // A bundle loaded while the page is still parsing draws on DOMContentLoaded.
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
          try { describeDrawnFigures(); } catch (_) { /* leave bundle's labels */ }
        });
      }
    }
    return a && b;
  }

  // Only browser documents need renderer initialization. The static-build CLI
  // uses the description API without a renderer or timers keeping Node alive.
  // Poll briefly when the browser bundle is still loading; cap at ~5 s.
  if (typeof document !== 'undefined' && !tryPatch()) {
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
