/**
 * UML Class Diagram Renderer
 *
 * Custom SVG renderer for UML class diagrams with proper shared-target
 * inheritance arrows and full UML notation support.
 *
 * Text format:
 *   @startuml
 *   class Animal { +name: str; +speak() }
 *   abstract class Shape { -color: int; +{abstract} area(): double }
 *   interface Drawable { +draw() }
 *   Dog --|> Animal
 *   Circle ..|> Drawable
 *   Zoo *-- Animal : contains
 *   @enduml
 *
 * Relationship tokens:
 *   --|>  Generalization (solid, hollow triangle)
 *   ..|>  Realization (dashed, hollow triangle)
 *   --    Association (solid)
 *   -->   Navigable association (solid, open arrow)
 *   *--   Composition (solid, filled diamond)
 *   o--   Aggregation (solid, hollow diamond)
 *   ..>   Dependency (dashed, open arrow)
 */
(function () {
  'use strict';

  // ─── Configuration ────────────────────────────────────────────────

  var CFG = {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    fontSize: 14,
    fontSizeBold: 15,
    fontSizeStereotype: 13,
    lineHeight: 22,
    padX: 14,
    padY: 6,
    gapX: 60,
    gapY: 80,
    triangleH: 14,
    triangleW: 14,
    diamondH: 14,
    diamondW: 10,
    arrowSize: 10,
    strokeWidth: 1.5,
    minBoxWidth: 100,
    svgPad: 30,
    junctionGap: 20,
    labelOffset: 8,
    multOffset: 14,
  };

  // ─── Parser ───────────────────────────────────────────────────────

  /**
   * Parse UML class diagram text format into structured data.
   * @param {string} text - The diagram specification
   * @returns {{ classes: Array, relationships: Array }}
   */
  function parse(text) {
    var lines = text.split('\n');
    var classes = [];
    var relationships = [];
    var classMap = {};
    var notes = [];
    var inClass = null;
    var braceDepth = 0;
    var direction = 'TB';

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line === '@startuml' || line === '@enduml') continue;

      // Layout directive
      var layoutMatch = line.match(/^layout\s+(horizontal|vertical|left-to-right|top-to-bottom|LR|TB)$/i);
      if (layoutMatch && inClass === null) {
        var val = layoutMatch[1].toLowerCase();
        direction = (val === 'horizontal' || val === 'left-to-right' || val === 'lr') ? 'LR' : 'TB';
        continue;
      }

      // If we're inside a class body
      if (inClass !== null) {
        // Count braces
        for (var ci = 0; ci < line.length; ci++) {
          if (line[ci] === '{') braceDepth++;
          if (line[ci] === '}') braceDepth--;
        }
        if (braceDepth <= 0) {
          inClass = null;
          braceDepth = 0;
          continue;
        }
        // Parse member line
        var member = parseMember(line);
        if (member) {
          if (member.isMethod) {
            inClass.methods.push(member);
          } else {
            inClass.attributes.push(member);
          }
        }
        continue;
      }

      // Note
      var noteIdx = UMLShared.parseNoteLine(line, lines, i, notes);
      if (noteIdx >= 0) { i = noteIdx; continue; }

      // Try to parse class declaration
      var cls = parseClassDecl(line);
      if (cls) {
        // Check if this line also contains opening brace
        if (line.indexOf('{') !== -1) {
          braceDepth = 1;
          // Check if closing brace is on same line
          if (line.indexOf('}') !== -1 && line.indexOf('}') > line.indexOf('{')) {
            // Single-line class: extract body
            var bodyStart = line.indexOf('{') + 1;
            var bodyEnd = line.lastIndexOf('}');
            var body = line.substring(bodyStart, bodyEnd).trim();
            if (body) {
              var parts = body.split(';');
              for (var p = 0; p < parts.length; p++) {
                var m = parseMember(parts[p].trim());
                if (m) {
                  if (m.isMethod) cls.methods.push(m);
                  else cls.attributes.push(m);
                }
              }
            }
            braceDepth = 0;
          } else {
            inClass = cls;
          }
        }
        classes.push(cls);
        classMap[cls.name] = cls;
        continue;
      }

      // Try to parse relationship
      var rel = parseRelationship(line);
      if (rel) {
        relationships.push(rel);
        continue;
      }
    }

    return { classes: classes, relationships: relationships, notes: notes, direction: direction };
  }

  /**
   * Parse a class declaration line.
   * Supports: class Name, abstract class Name, interface Name,
   *           class Name <<stereotype>>
   */
  function parseClassDecl(line) {
    // Remove trailing { if present
    var cleanLine = line.replace(/\s*\{.*$/, '').trim();

    var classType = 'class';
    var name = '';
    var stereotype = null;

    // Extract stereotype <<...>> if present
    var stereoMatch = cleanLine.match(/<<([^>]+)>>/);
    if (stereoMatch) {
      stereotype = stereoMatch[1];
      cleanLine = cleanLine.replace(/\s*<<[^>]+>>/, '').trim();
    }

    if (/^abstract\s+class\s+/.test(cleanLine)) {
      classType = 'abstract';
      name = cleanLine.replace(/^abstract\s+class\s+/, '').trim();
    } else if (/^interface\s+/.test(cleanLine)) {
      classType = 'interface';
      name = cleanLine.replace(/^interface\s+/, '').trim();
    } else if (/^enum\s+/.test(cleanLine)) {
      classType = 'enum';
      name = cleanLine.replace(/^enum\s+/, '').trim();
    } else if (/^class\s+/.test(cleanLine)) {
      classType = 'class';
      name = cleanLine.replace(/^class\s+/, '').trim();
    } else {
      return null;
    }

    if (!name) return null;

    return {
      name: name,
      type: classType,
      stereotype: stereotype,
      attributes: [],
      methods: [],
    };
  }

  /**
   * Parse a member line (attribute or method).
   * Format: [visibility] [{modifier}] name[(params)] [: Type]
   */
  function parseMember(line) {
    line = line.trim();
    if (!line || line === '{' || line === '}') return null;

    var visibility = '';
    var isAbstract = false;
    var isStatic = false;

    // Extract visibility prefix
    if (/^[+\-#~]/.test(line)) {
      visibility = line[0];
      line = line.substring(1).trim();
    }

    // Extract modifiers {abstract}, {static}
    var modMatch = line.match(/^\{(\w+)\}\s*/);
    if (modMatch) {
      var mod = modMatch[1].toLowerCase();
      if (mod === 'abstract') isAbstract = true;
      if (mod === 'static') isStatic = true;
      line = line.substring(modMatch[0].length);
    }

    // Determine if method (has parentheses)
    var isMethod = line.indexOf('(') !== -1;

    return {
      text: (visibility ? visibility : '') + line,
      visibility: visibility,
      isMethod: isMethod,
      isAbstract: isAbstract,
      isStatic: isStatic,
    };
  }

  // Relationship patterns ordered by specificity
  var REL_PATTERNS = [
    { token: '--|>', type: 'generalization' },
    { token: '..|>', type: 'realization' },
    { token: '*--', type: 'composition' },
    { token: 'o--', type: 'aggregation' },
    { token: '-->', type: 'navigable' },
    { token: '..>', type: 'dependency' },
    { token: '--',  type: 'association' },
  ];

  /**
   * Parse a relationship line.
   * Format: From [mult] token [mult] To [: label]
   */
  function parseRelationship(line) {
    for (var r = 0; r < REL_PATTERNS.length; r++) {
      var pat = REL_PATTERNS[r];
      var idx = line.indexOf(' ' + pat.token + ' ');
      if (idx === -1) continue;

      var leftPart = line.substring(0, idx).trim();
      var rightPart = line.substring(idx + pat.token.length + 2).trim();

      // Extract label after ':'
      var label = '';
      var colonIdx = rightPart.lastIndexOf(' : ');
      if (colonIdx !== -1) {
        label = rightPart.substring(colonIdx + 3).trim();
        rightPart = rightPart.substring(0, colonIdx).trim();
      }

      // Extract multiplicities from brackets
      var fromMult = '';
      var toMult = '';

      // Check left side for quoted multiplicity
      var leftMultMatch = leftPart.match(/^(.+?)\s+"([^"]+)"$/);
      if (leftMultMatch) {
        leftPart = leftMultMatch[1].trim();
        fromMult = leftMultMatch[2];
      }

      // Check right side for quoted multiplicity
      var rightMultMatch = rightPart.match(/^"([^"]+)"\s+(.+)$/);
      if (rightMultMatch) {
        toMult = rightMultMatch[1];
        rightPart = rightMultMatch[2].trim();
      }

      // Also support bracket syntax: A [1] -- [*] B
      if (!fromMult) {
        var leftBracketMatch = leftPart.match(/^(.+?)\s+\[([^\]]+)\]$/);
        if (leftBracketMatch) {
          leftPart = leftBracketMatch[1].trim();
          fromMult = leftBracketMatch[2];
        }
      }
      if (!toMult) {
        var rightBracketMatch = rightPart.match(/^\[([^\]]+)\]\s+(.+)$/);
        if (rightBracketMatch) {
          toMult = rightBracketMatch[1];
          rightPart = rightBracketMatch[2].trim();
        }
      }

      return {
        from: leftPart,
        to: rightPart,
        type: pat.type,
        label: label,
        fromMult: fromMult,
        toMult: toMult,
      };
    }
    return null;
  }

  // ─── Text Measurement (uses UMLShared.textWidth) ──────────────────

  // ─── Layout ───────────────────────────────────────────────────────

  /**
   * Measure a class box.
   * Returns { width, height, nameH, stereotypeH, attrH, methH }
   */
  function measureBox(cls) {
    var hasStereotype = cls.type === 'abstract' || cls.type === 'interface' || cls.type === 'enum' || cls.stereotype;
    var stereotypeText = '';
    if (cls.stereotype) stereotypeText = '\u00AB' + cls.stereotype + '\u00BB';
    else if (cls.type === 'abstract') stereotypeText = '\u00ABabstract\u00BB';
    else if (cls.type === 'interface') stereotypeText = '\u00ABinterface\u00BB';
    else if (cls.type === 'enum') stereotypeText = '\u00ABenumeration\u00BB';

    var stereotypeH = hasStereotype ? CFG.lineHeight : 0;
    var nameH = CFG.padY * 2 + CFG.lineHeight + stereotypeH;

    var nameW = UMLShared.textWidth(cls.name, true, CFG.fontSizeBold);
    if (hasStereotype) {
      nameW = Math.max(nameW, UMLShared.textWidth(stereotypeText, false, CFG.fontSizeStereotype));
    }

    var attrMaxW = 0;
    for (var a = 0; a < cls.attributes.length; a++) {
      attrMaxW = Math.max(attrMaxW, UMLShared.textWidth(cls.attributes[a].text, false));
    }
    var attrH = cls.attributes.length > 0 ? CFG.padY * 2 + cls.attributes.length * CFG.lineHeight : 0;

    var methMaxW = 0;
    for (var m = 0; m < cls.methods.length; m++) {
      methMaxW = Math.max(methMaxW, UMLShared.textWidth(cls.methods[m].text, false));
    }
    var methH = cls.methods.length > 0 ? CFG.padY * 2 + cls.methods.length * CFG.lineHeight : 0;

    var width = Math.max(CFG.minBoxWidth, nameW + CFG.padX * 2, attrMaxW + CFG.padX * 2, methMaxW + CFG.padX * 2);
    // Round up to even number for crisp centering
    width = Math.ceil(width / 2) * 2;
    var height = nameH + attrH + methH;

    return {
      width: width,
      height: height,
      nameH: nameH,
      stereotypeH: stereotypeH,
      attrH: attrH,
      methH: methH,
      stereotypeText: stereotypeText,
    };
  }


  /**
   * Compute layout positions for all class boxes using AdvancedAlgorithmic framework.
   */
  function computeLayout(parsed) {
    var classes = parsed.classes;
    var relationships = parsed.relationships;
    if (classes.length === 0) return { entries: {}, width: 0, height: 0, offsetX: 0, offsetY: 0 };

    var entries = {};
    var layoutNodes = [];
    var layoutEdges = [];

    // Measure boxes & construct layout input
    for (var i = 0; i < classes.length; i++) {
      var cls = classes[i];
      var box = measureBox(cls);
      entries[cls.name] = {
        cls: cls,
        box: box,
        x: 0,
        y: 0
      };
      layoutNodes.push({ id: cls.name, width: box.width, height: box.height, data: cls });
    }

    // Construct edge input
    for (var r = 0; r < relationships.length; r++) {
      var rel = relationships[r];
      layoutEdges.push({ source: rel.from, target: rel.to, type: rel.type, data: rel });
    }

    // Use advanced constraints engine
    var effectiveGapX = CFG.gapX;
    for (var rg = 0; rg < relationships.length; rg++) {
      var rgRel = relationships[rg];
      var neededW = 0;
      if (rgRel.label) {
        neededW = Math.max(neededW, UMLShared.textWidth(rgRel.label, false, CFG.fontSizeStereotype) + 40);
      }
      var multW = 0;
      if (rgRel.fromMult) multW += UMLShared.textWidth(rgRel.fromMult, false, CFG.fontSizeStereotype) + 12;
      if (rgRel.toMult) multW += UMLShared.textWidth(rgRel.toMult, false, CFG.fontSizeStereotype) + 12;
      neededW = Math.max(neededW, multW + 20);
      effectiveGapX = Math.max(effectiveGapX, neededW);
    }

    var result = window.UMLAdvancedLayout.compute(layoutNodes, layoutEdges, { gapX: effectiveGapX, gapY: CFG.gapY, direction: parsed.direction || 'TB' });

    // Read back positions
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var n in result.nodes) {
      if (!entries[n]) continue;
      entries[n].x = result.nodes[n].x;
      entries[n].y = result.nodes[n].y;
      
      minX = Math.min(minX, entries[n].x);
      minY = Math.min(minY, entries[n].y);
      maxX = Math.max(maxX, entries[n].x + entries[n].box.width);
      maxY = Math.max(maxY, entries[n].y + entries[n].box.height);
    }

    return {
      entries: entries,
      width: maxX - minX,
      height: maxY - minY,
      offsetX: -minX,
      offsetY: -minY,
      layoutResult: result // passthrough edge route if ever needed by generateSVG
    };
  }

  // ─── SVG Renderer ─────────────────────────────────────────────────



  /**
   * Generate full SVG string from layout and relationships.
   */
  function generateSVG(layout, parsed, colors) {
    var entries = layout.entries;
    var relationships = parsed.relationships;

    // Resolve note target — supports ClassName or ClassName.memberName
    function resolveTarget(target) {
      var parts = target.split('.');
      var className = parts[0];
      var memberName = parts.length > 1 ? parts.slice(1).join('.') : null;
      var entry = entries[className];
      if (!entry) return null;
      var box = entry.box;
      if (!memberName) {
        return { x: entry.x, y: entry.y, w: box.width, h: box.height };
      }
      // Search attributes
      var cls = entry.cls;
      for (var ai = 0; ai < cls.attributes.length; ai++) {
        if (cls.attributes[ai].text.indexOf(memberName) !== -1) {
          var ay = entry.y + box.nameH + CFG.padY + ai * CFG.lineHeight;
          return { x: entry.x, y: ay, w: box.width, h: CFG.lineHeight };
        }
      }
      // Search methods
      for (var mi = 0; mi < cls.methods.length; mi++) {
        if (cls.methods[mi].text.indexOf(memberName) !== -1) {
          var my = entry.y + box.nameH + box.attrH + CFG.padY + mi * CFG.lineHeight;
          return { x: entry.x, y: my, w: box.width, h: CFG.lineHeight };
        }
      }
      return { x: entry.x, y: entry.y, w: box.width, h: box.height };
    }

    // Pre-compute note positions so SVG bounds can be expanded
    var notePositions = [];
    if (parsed.notes) {
      var noteGap = UMLShared.NOTE_CFG.gap;
      for (var npi = 0; npi < parsed.notes.length; npi++) {
        var pn = parsed.notes[npi];
        var tgt = resolveTarget(pn.target);
        if (!tgt) continue;
        var ns = UMLShared.measureNote(pn.lines);
        var nx, ny;
        var tx = tgt.x, ty = tgt.y, tw = tgt.w, th = tgt.h;
        if (pn.position === 'right') { nx = tx + tw + noteGap; ny = ty; }
        else if (pn.position === 'left') { nx = tx - ns.width - noteGap; ny = ty; }
        else if (pn.position === 'top') { nx = tx; ny = ty - ns.height - noteGap; }
        else { nx = tx; ny = ty + th + noteGap; }
        notePositions.push({ note: pn, x: nx, y: ny, w: ns.width, h: ns.height,
          tx: tx, ty: ty, tw: tw, th: th });
      }
    }

    // Expand SVG bounds to fit notes
    var extraLeft = 0, extraRight = 0, extraTop = 0, extraBottom = 0;
    for (var nbi = 0; nbi < notePositions.length; nbi++) {
      var np = notePositions[nbi];
      var minNX = np.x - CFG.svgPad;
      var maxNX = np.x + np.w + CFG.svgPad;
      var minNY = np.y - CFG.svgPad;
      var maxNY = np.y + np.h + CFG.svgPad;
      if (minNX < -layout.offsetX) extraLeft = Math.max(extraLeft, -layout.offsetX - minNX);
      if (maxNX > layout.width - layout.offsetX) extraRight = Math.max(extraRight, maxNX - (layout.width - layout.offsetX));
      if (minNY < -layout.offsetY) extraTop = Math.max(extraTop, -layout.offsetY - minNY);
      if (maxNY > layout.height - layout.offsetY) extraBottom = Math.max(extraBottom, maxNY - (layout.height - layout.offsetY));
    }

    var ox = layout.offsetX + CFG.svgPad + extraLeft;
    var oy = layout.offsetY + CFG.svgPad + extraTop;
    var svgW = layout.width + CFG.svgPad * 2 + extraLeft + extraRight;
    var svgH = layout.height + CFG.svgPad * 2 + extraTop + extraBottom;

    var svg = [];
    svg.push(UMLShared.svgOpen(svgW, svgH, ox, oy, CFG.fontFamily));

    // ── Draw relationships ──
    var decorSvg = []; // arrowhead decorations drawn after class boxes

    // Group generalization/realization by target for shared-target rendering
    var inheritGroups = {};  // target -> { type, children: [] }
    var otherRels = [];
    var hasInheritAtBottom = {}; // classes that have inheritance triangle at bottom
    var hasInheritAtTop = {};   // classes that have inheritance arrow entering at top

    for (var r = 0; r < relationships.length; r++) {
      var rel = relationships[r];
      if (!entries[rel.from] || !entries[rel.to]) continue;

      if (rel.type === 'generalization' || rel.type === 'realization') {
        var key = rel.to + ':' + rel.type;
        if (!inheritGroups[key]) {
          inheritGroups[key] = { target: rel.to, type: rel.type, children: [], label: rel.label };
        }
        inheritGroups[key].children.push(rel.from);
        hasInheritAtBottom[rel.to] = true;
        hasInheritAtTop[rel.from] = true;
      } else {
        otherRels.push(rel);
      }
    }

    // Pre-compute per-child offsets: when a child has multiple parent groups
    // (e.g. generalization AND realization), offset connection points on the
    // child's top edge so lines don't overlap.
    var childParentCount = {};  // childName -> total number of parent groups
    var childParentIdx = {};    // groupKey + ':' + childName -> index for this group
    var groupKeys = [];
    for (var gk0 in inheritGroups) groupKeys.push(gk0);
    for (var gki = 0; gki < groupKeys.length; gki++) {
      var grp = inheritGroups[groupKeys[gki]];
      for (var gci = 0; gci < grp.children.length; gci++) {
        var cname = grp.children[gci];
        if (!childParentCount[cname]) childParentCount[cname] = 0;
        childParentIdx[groupKeys[gki] + ':' + cname] = childParentCount[cname];
        childParentCount[cname]++;
      }
    }

    // Helper: get the X offset for a child's connection point to a specific group
    var inheritPortSpacing = 20;
    function childConnX(childEntry, childName, groupKey) {
      var total = childParentCount[childName] || 1;
      var idx = childParentIdx[groupKey + ':' + childName] || 0;
      var cx = childEntry.x + childEntry.box.width / 2;
      if (total <= 1) return cx;
      // Spread connection points evenly around center
      var span = (total - 1) * inheritPortSpacing;
      return cx - span / 2 + idx * inheritPortSpacing;
    }

    // Draw inheritance/realization with shared-target style
    for (var gk in inheritGroups) {
      var group = inheritGroups[gk];
      var parentEntry = entries[group.target];
      var isDashed = group.type === 'realization';
      var dashAttr = isDashed ? ' stroke-dasharray="8,4"' : '';

      var parentCx = parentEntry.x + parentEntry.box.width / 2;
      var parentBot = parentEntry.y + parentEntry.box.height;

      // Hollow triangle at parent bottom (deferred to draw on top of class boxes)
      var triTop = parentBot;
      var triBot = parentBot + CFG.triangleH;
      decorSvg.push('<polygon points="' +
        parentCx + ',' + triTop + ' ' +
        (parentCx - CFG.triangleW / 2) + ',' + triBot + ' ' +
        (parentCx + CFG.triangleW / 2) + ',' + triBot +
        '" fill="' + colors.fill + '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');

      if (group.children.length === 1) {
        // Single child: orthogonal (90-degree) routing
        var child = entries[group.children[0]];
        var childCx = childConnX(child, group.children[0], gk);
        var childTop = child.y;
        if (Math.abs(parentCx - childCx) < 1) {
          // Aligned: single vertical line
          svg.push('<line x1="' + parentCx + '" y1="' + triBot + '" x2="' + childCx + '" y2="' + childTop +
            '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');
        } else {
          // Not aligned: vertical from triangle, horizontal jog, vertical to child
          var junctionY = (triBot + childTop) / 2;
          svg.push('<line x1="' + parentCx + '" y1="' + triBot + '" x2="' + parentCx + '" y2="' + junctionY +
            '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');
          svg.push('<line x1="' + parentCx + '" y1="' + junctionY + '" x2="' + childCx + '" y2="' + junctionY +
            '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');
          svg.push('<line x1="' + childCx + '" y1="' + junctionY + '" x2="' + childCx + '" y2="' + childTop +
            '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');
        }
      } else {
        // Multiple children: shared-target
        var childTops = [];
        var childCxArr = [];
        for (var ci = 0; ci < group.children.length; ci++) {
          var ch = entries[group.children[ci]];
          childCxArr.push(childConnX(ch, group.children[ci], gk));
          childTops.push(ch.y);
        }
        var minChildTop = Math.min.apply(null, childTops);
        var junctionY = (triBot + minChildTop) / 2;

        // Trunk: triangle bottom to junction
        svg.push('<line x1="' + parentCx + '" y1="' + triBot + '" x2="' + parentCx + '" y2="' + junctionY +
          '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');

        // Horizontal bar at junction
        var leftCx = Math.min.apply(null, childCxArr);
        var rightCx = Math.max.apply(null, childCxArr);
        svg.push('<line x1="' + leftCx + '" y1="' + junctionY + '" x2="' + rightCx + '" y2="' + junctionY +
          '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');

        // Vertical stems from junction to each child
        for (var ci2 = 0; ci2 < group.children.length; ci2++) {
          var ch2 = entries[group.children[ci2]];
          var cx = childCxArr[ci2];
          svg.push('<line x1="' + cx + '" y1="' + junctionY + '" x2="' + cx + '" y2="' + ch2.y +
            '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');
        }
      }
    }

    // Pre-compute port offsets: when multiple edges exit from the same side of a box,
    // offset them vertically so they don't overlap
    var exitPortCounts = {}; // "className:side" -> count
    var exitPortIdx = {};    // edgeIndex -> portIndex
    for (var epi = 0; epi < otherRels.length; epi++) {
      var epRel = otherRels[epi];
      if (!entries[epRel.from] || !entries[epRel.to]) continue;
      var epFrom = entries[epRel.from];
      var epTo = entries[epRel.to];
      // Determine which side the edge exits from
      var epFromCx = epFrom.x + epFrom.box.width / 2;
      var epToCx = epTo.x + epTo.box.width / 2;
      var epSide = (hasInheritAtBottom[epRel.from]) ? ((epToCx >= epFromCx) ? 'right' : 'left') :
        (Math.abs(epToCx - epFromCx) >
         Math.abs(epTo.y + epTo.box.height/2 - epFrom.y - epFrom.box.height/2) * 0.6) ?
        ((epToCx > epFromCx) ? 'right' : 'left') :
        ((epTo.y > epFrom.y) ? 'bottom' : 'top');
      var epKey = epRel.from + ':' + epSide;
      if (!exitPortCounts[epKey]) exitPortCounts[epKey] = 0;
      exitPortIdx[epi] = exitPortCounts[epKey];
      exitPortCounts[epKey]++;
    }

    // Draw other relationships with orthogonal (right-angle) routing
    for (var oi = 0; oi < otherRels.length; oi++) {
      var orel = otherRels[oi];
      var fromE = entries[orel.from];
      var toE = entries[orel.to];
      if (!fromE || !toE) continue;

      var isDash = orel.type === 'dependency';
      var dAttr = isDash ? ' stroke-dasharray="8,4"' : '';

      // Compute orthogonal route, with port offset for multiple edges from same side
      var portOffset = exitPortIdx[oi] * 16;
      var route = computeOrthogonalRoute(fromE, toE, hasInheritAtBottom[orel.from], hasInheritAtTop[orel.to], portOffset, entries, orel.from, orel.to);
      var pathPoints = route.points; // array of {x,y}

      // Build polyline points string
      var pointsStr = '';
      for (var pi3 = 0; pi3 < pathPoints.length; pi3++) {
        if (pi3 > 0) pointsStr += ' ';
        pointsStr += pathPoints[pi3].x + ',' + pathPoints[pi3].y;
      }

      // Draw main polyline
      svg.push('<polyline points="' + pointsStr +
        '" fill="none" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dAttr + '/>');

      // Determine direction at each end for decorations
      var p0 = pathPoints[0], p1 = pathPoints[1];
      var pLast = pathPoints[pathPoints.length - 1], pPrev = pathPoints[pathPoints.length - 2];

      // Direction FROM start (away from source box)
      var startDx = p1.x - p0.x, startDy = p1.y - p0.y;
      var startLen = Math.sqrt(startDx * startDx + startDy * startDy);
      if (startLen > 0) { startDx /= startLen; startDy /= startLen; }

      // Direction INTO end (arriving at target box)
      var endDx = pLast.x - pPrev.x, endDy = pLast.y - pPrev.y;
      var endLen = Math.sqrt(endDx * endDx + endDy * endDy);
      if (endLen > 0) { endDx /= endLen; endDy /= endLen; }

      // Source decorations (deferred to draw on top of class boxes)
      if (orel.type === 'composition') {
        drawDiamond(decorSvg, p0.x, p0.y, startDx, startDy, -startDy, startDx, colors.line, true, colors.fill);
      } else if (orel.type === 'aggregation') {
        drawDiamond(decorSvg, p0.x, p0.y, startDx, startDy, -startDy, startDx, colors.line, false, colors.fill);
      }

      // Target decorations (deferred to draw on top of class boxes)
      if (orel.type === 'navigable' || orel.type === 'dependency') {
        drawOpenArrow(decorSvg, pLast.x, pLast.y, -endDx, -endDy, endDy, -endDx, colors.line);
      }

      // Determine if the first/last segment is horizontal or vertical
      var isFirstHoriz = (Math.abs(startDy) < 0.1);
      var isLastHoriz = (Math.abs(endDy) < 0.1);

      // Draw label at midpoint of the longest segment
      if (orel.label) {
        // Find the longest segment for label placement
        var bestSegIdx = 0, bestSegLen = 0;
        for (var si = 0; si < pathPoints.length - 1; si++) {
          var segLen = Math.abs(pathPoints[si+1].x - pathPoints[si].x) + Math.abs(pathPoints[si+1].y - pathPoints[si].y);
          if (segLen > bestSegLen) { bestSegLen = segLen; bestSegIdx = si; }
        }
        var seg0 = pathPoints[bestSegIdx], seg1 = pathPoints[bestSegIdx + 1];
        var labelX = (seg0.x + seg1.x) / 2;
        var labelY = (seg0.y + seg1.y) / 2;
        var isMidHoriz = Math.abs(seg1.y - seg0.y) < 1;
        if (isMidHoriz) {
          labelY -= 8;
        } else {
          labelX -= 12;
        }
        svg.push('<text x="' + labelX + '" y="' + labelY + '" text-anchor="middle" ' +
          'font-size="' + CFG.fontSizeStereotype + '" fill="' + colors.text + '" ' +
          'stroke="' + colors.fill + '" stroke-width="4" stroke-opacity="0.85" stroke-linejoin="round" paint-order="stroke" ' +
          'font-style="italic">' + UMLShared.escapeXml(orel.label) + '</text>');
      }

      // Draw multiplicities near their respective endpoints, well clear of the box
      if (orel.fromMult) {
        var fmx, fmy;
        if (isFirstHoriz) {
          // Horizontal exit: place multiplicity above the line, near source box edge
          fmx = p0.x + startDx * 6;
          fmy = p0.y - 8;
        } else {
          // Vertical exit: place to the right of the lifeline
          fmx = p0.x + 8;
          fmy = p0.y + startDy * 14;
        }
        svg.push('<text x="' + fmx + '" y="' + fmy + '" ' +
          'font-size="' + CFG.fontSizeStereotype + '" fill="' + colors.text + '" ' +
          'stroke="' + colors.fill + '" stroke-width="4" stroke-opacity="0.85" stroke-linejoin="round" paint-order="stroke">' +
          UMLShared.escapeXml(orel.fromMult) + '</text>');
      }
      if (orel.toMult) {
        var tmx, tmy;
        if (isLastHoriz) {
          // Horizontal entry: place multiplicity above the line, near target box edge
          tmx = pLast.x - endDx * 6;
          tmy = pLast.y - 8;
          // Anchor toward the target box
          var tmAnchor = (endDx > 0) ? 'end' : 'start';
        } else {
          tmx = pLast.x + 8;
          tmy = pLast.y - endDy * 14;
          tmAnchor = 'start';
        }
        svg.push('<text x="' + tmx + '" y="' + tmy + '" text-anchor="' + (tmAnchor || 'start') + '" ' +
          'font-size="' + CFG.fontSizeStereotype + '" fill="' + colors.text + '" ' +
          'stroke="' + colors.fill + '" stroke-width="4" stroke-opacity="0.85" stroke-linejoin="round" paint-order="stroke">' +
          UMLShared.escapeXml(orel.toMult) + '</text>');
      }
    }

    // ── Draw class boxes (on top of lines) ──

    for (var en in entries) {
      var e = entries[en];
      var cls = e.cls;
      var box = e.box;
      var x = e.x, y = e.y;
      var isInterface = cls.type === 'interface';
      var boxDash = '';  // All class boxes use solid borders (including interfaces)

      // Header compartment
      svg.push('<rect x="' + x + '" y="' + y + '" width="' + box.width + '" height="' + box.nameH +
        '" fill="' + colors.headerFill + '" stroke="none"/>');

      // Attribute compartment (if non-empty)
      if (box.attrH > 0) {
        svg.push('<rect x="' + x + '" y="' + (y + box.nameH) + '" width="' + box.width + '" height="' + box.attrH +
          '" fill="' + colors.fill + '" stroke="none"/>');
      }

      // Method compartment (if non-empty)
      if (box.methH > 0) {
        svg.push('<rect x="' + x + '" y="' + (y + box.nameH + box.attrH) + '" width="' + box.width + '" height="' + box.methH +
          '" fill="' + colors.fill + '" stroke="none"/>');
      }

      // Overall border
      svg.push('<rect x="' + x + '" y="' + y + '" width="' + box.width + '" height="' + box.height +
        '" fill="none" stroke="' + colors.stroke + '" stroke-width="' + CFG.strokeWidth + '"' + boxDash + '/>');

      // Compartment dividers (only between non-empty sections)
      if (box.attrH > 0 || box.methH > 0) {
        svg.push('<line x1="' + x + '" y1="' + (y + box.nameH) + '" x2="' + (x + box.width) + '" y2="' + (y + box.nameH) +
          '" stroke="' + colors.stroke + '" stroke-width="' + CFG.strokeWidth + '"' + boxDash + '/>');
      }
      if (box.attrH > 0 && box.methH > 0) {
        svg.push('<line x1="' + x + '" y1="' + (y + box.nameH + box.attrH) + '" x2="' + (x + box.width) + '" y2="' + (y + box.nameH + box.attrH) +
          '" stroke="' + colors.stroke + '" stroke-width="' + CFG.strokeWidth + '"' + boxDash + '/>');
      }

      // Stereotype text
      var textCx = x + box.width / 2;
      if (box.stereotypeText) {
        var stereoY = y + CFG.padY + CFG.lineHeight * 0.75;
        svg.push('<text x="' + textCx + '" y="' + stereoY + '" text-anchor="middle" ' +
          'font-size="' + CFG.fontSizeStereotype + '" fill="' + colors.text + '">' +
          UMLShared.escapeXml(box.stereotypeText) + '</text>');
      }

      // Class name
      var nameY = y + CFG.padY + box.stereotypeH + CFG.lineHeight * 0.75;
      var isAbstract = cls.type === 'abstract';
      svg.push('<text x="' + textCx + '" y="' + nameY + '" text-anchor="middle" ' +
        'font-weight="bold" font-size="' + CFG.fontSizeBold + '" ' +
        (isAbstract ? 'font-style="italic" ' : '') +
        'fill="' + colors.text + '">' + UMLShared.escapeXml(cls.name) + '</text>');

      // Attributes
      var attrBaseY = y + box.nameH + CFG.padY;
      for (var ai = 0; ai < cls.attributes.length; ai++) {
        var attr = cls.attributes[ai];
        var attrY = attrBaseY + (ai + 0.75) * CFG.lineHeight;
        var attrStyle = '';
        if (attr.isAbstract) attrStyle += 'font-style:italic;';
        if (attr.isStatic) attrStyle += 'text-decoration:underline;';
        svg.push('<text x="' + (x + CFG.padX) + '" y="' + attrY + '" ' +
          'font-size="' + CFG.fontSize + '" fill="' + colors.text + '"' +
          (attrStyle ? ' style="' + attrStyle + '"' : '') + '>' +
          UMLShared.escapeXml(attr.text) + '</text>');
      }

      // Methods
      var methBaseY = y + box.nameH + box.attrH + CFG.padY;
      for (var mi = 0; mi < cls.methods.length; mi++) {
        var meth = cls.methods[mi];
        var methY = methBaseY + (mi + 0.75) * CFG.lineHeight;
        var methStyle = '';
        if (meth.isAbstract) methStyle += 'font-style:italic;';
        if (meth.isStatic) methStyle += 'text-decoration:underline;';
        svg.push('<text x="' + (x + CFG.padX) + '" y="' + methY + '" ' +
          'font-size="' + CFG.fontSize + '" fill="' + colors.text + '"' +
          (methStyle ? ' style="' + methStyle + '"' : '') + '>' +
          UMLShared.escapeXml(meth.text) + '</text>');
      }
    }

    // ── Draw arrowhead decorations on top of class boxes ──
    for (var di = 0; di < decorSvg.length; di++) svg.push(decorSvg[di]);

    // ── Draw notes (using pre-computed positions) ──
    for (var ni = 0; ni < notePositions.length; ni++) {
      var np2 = notePositions[ni];
      var connFrom, connTo;
      if (np2.note.position === 'right') {
        connFrom = { x: np2.x, y: np2.y + np2.h / 2 };
        connTo = { x: np2.tx + np2.tw, y: np2.ty + np2.th / 2 };
      } else if (np2.note.position === 'left') {
        connFrom = { x: np2.x + np2.w, y: np2.y + np2.h / 2 };
        connTo = { x: np2.tx, y: np2.ty + np2.th / 2 };
      } else if (np2.note.position === 'top') {
        connFrom = { x: np2.x + np2.w / 2, y: np2.y + np2.h };
        connTo = { x: np2.tx + np2.tw / 2, y: np2.ty };
      } else {
        connFrom = { x: np2.x + np2.w / 2, y: np2.y };
        connTo = { x: np2.tx + np2.tw / 2, y: np2.ty + np2.th };
      }
      UMLShared.drawNote(svg, np2.x, np2.y, np2.note.lines, colors,
        { fromX: connFrom.x, fromY: connFrom.y, toX: connTo.x, toY: connTo.y });
    }

    svg.push(UMLShared.svgClose());
    return svg.join('\n');
  }

  /**
   * Compute orthogonal (Manhattan) route between two class boxes.
   * Prefers straight lines when boxes are aligned vertically or horizontally.
   * Uses right-angle bends only when necessary.
   * Returns { points: [{x,y}, ...] } with only horizontal/vertical segments.
   */
  function computeOrthogonalRoute(fromE, toE, avoidFromBottom, avoidToTop, portOffset, allEntries, fromId, toId) {
    portOffset = portOffset || 0;
    var fromCx = fromE.x + fromE.box.width / 2;
    var fromCy = fromE.y + fromE.box.height / 2 + portOffset;
    var fromL = fromE.x, fromR = fromE.x + fromE.box.width;
    var fromT = fromE.y, fromB = fromE.y + fromE.box.height;

    var toCx = toE.x + toE.box.width / 2;
    var toCy = toE.y + toE.box.height / 2;
    var toL = toE.x, toR = toE.x + toE.box.width;
    var toT = toE.y, toB = toE.y + toE.box.height;

    // Check if boxes overlap horizontally (can use vertical straight line)
    var hOverlap = fromL < toR && fromR > toL;
    // Check if boxes overlap vertically (can use horizontal straight line)
    var vOverlap = fromT < toB && fromB > toT;

    var points;

    // If we must avoid bottom of source (inheritance triangle there),
    // force exit from right or left side instead
    if (avoidFromBottom && !vOverlap) {
      // If target is nearly centered below source, use left side exit with L-route
      // to avoid crossing through sibling boxes
      var exitSide, exitX, entryX;
      if (Math.abs(toCx - fromCx) < fromE.box.width * 0.6) {
        // Target is roughly centered below — exit from the side away from other siblings
        exitSide = (toCx <= fromCx) ? 'left' : 'right';
      } else {
        exitSide = (toCx > fromCx) ? 'right' : 'left';
      }
      exitX = (exitSide === 'right') ? fromR : fromL;
      var exitY = fromCy + portOffset;
      var entryY = toCy;
      entryX = (toCx > fromCx) ? toL : toR;

      // If target is below, route: horizontal out, then vertical down to target top
      if (toCy > fromCy && !avoidToTop && exitY < toT) {
        // Route around: go out to the side, then drop at target edge (not center)
        var dropX = (exitSide === 'right') ? Math.max(fromR, toR) + 20 : Math.min(fromL, toL) - 20;
        points = [
          { x: exitX, y: exitY },
          { x: dropX, y: exitY },
          { x: dropX, y: toT },
          { x: toCx, y: toT }
        ];
      } else {
        // Horizontal route with vertical bend
        var midX2 = (exitX + entryX) / 2;
        points = [
          { x: exitX, y: exitY },
          { x: midX2, y: exitY },
          { x: midX2, y: entryY },
          { x: entryX, y: entryY }
        ];
      }
      // fall through to obstacle avoidance below
    } else if (hOverlap && !avoidFromBottom) {
      // Boxes overlap horizontally — use vertical straight line
      var overlapL = Math.max(fromL, toL);
      var overlapR = Math.min(fromR, toR);
      var connX = (overlapL + overlapR) / 2;

      if (fromCy < toCy) {
        points = [{ x: connX, y: fromB }, { x: connX, y: toT }];
      } else {
        points = [{ x: connX, y: fromT }, { x: connX, y: toB }];
      }
    } else if (hOverlap && avoidFromBottom) {
      // Horizontal overlap but must avoid bottom — use right side exit
      var exitX2 = fromR;
      var bypassX = Math.max(fromR, toR) + 20;
      if (fromCy < toCy) {
        points = [
          { x: exitX2, y: fromCy },
          { x: bypassX, y: fromCy },
          { x: bypassX, y: toCy },
          { x: toR, y: toCy }
        ];
      } else {
        points = [
          { x: exitX2, y: fromCy },
          { x: bypassX, y: fromCy },
          { x: bypassX, y: toCy },
          { x: toR, y: toCy }
        ];
      }
    } else if (vOverlap) {
      // Boxes overlap vertically — use horizontal straight line
      var overlapT = Math.max(fromT, toT);
      var overlapB = Math.min(fromB, toB);
      var connY = (overlapT + overlapB) / 2;

      if (fromCx < toCx) {
        points = [{ x: fromR, y: connY }, { x: toL, y: connY }];
      } else {
        points = [{ x: fromL, y: connY }, { x: toR, y: connY }];
      }
    } else {
      // No overlap — need an L-shaped or Z-shaped route
      var dx = toCx - fromCx;
      var dy = toCy - fromCy;

      if (Math.abs(dy) >= Math.abs(dx)) {
        // Primarily vertical separation — exit from bottom/top, bend horizontally
        if (dy > 0) {
          var midY = (fromB + toT) / 2;
          points = [
            { x: fromCx, y: fromB },
            { x: fromCx, y: midY },
            { x: toCx, y: midY },
            { x: toCx, y: toT }
          ];
        } else {
          var midY2 = (fromT + toB) / 2;
          points = [
            { x: fromCx, y: fromT },
            { x: fromCx, y: midY2 },
            { x: toCx, y: midY2 },
            { x: toCx, y: toB }
          ];
        }
      } else {
        // Primarily horizontal separation — exit from left/right, bend vertically
        if (dx > 0) {
          var midX = (fromR + toL) / 2;
          points = [
            { x: fromR, y: fromCy },
            { x: midX, y: fromCy },
            { x: midX, y: toCy },
            { x: toL, y: toCy }
          ];
        } else {
          var midX2 = (fromL + toR) / 2;
          points = [
            { x: fromL, y: fromCy },
            { x: midX2, y: fromCy },
            { x: midX2, y: toCy },
            { x: toR, y: toCy }
          ];
        }
      }

      // Simplify: remove redundant intermediate points on same axis
      points = simplifyPath(points);
    }

    // ── Obstacle avoidance: reroute segments that pass through other class boxes ──
    if (allEntries && points.length >= 2) {
      var pad = 12;
      var obstacles = [];
      for (var obn in allEntries) {
        if (obn === fromId || obn === toId) continue;
        var ob = allEntries[obn];
        obstacles.push({ l: ob.x - pad, t: ob.y - pad, r: ob.x + ob.box.width + pad, b: ob.y + ob.box.height + pad });
      }
      // Check each segment and reroute if needed (one pass)
      var newPoints = [points[0]];
      for (var si = 0; si < points.length - 1; si++) {
        var p1 = points[si], p2 = points[si + 1];
        var rerouted = false;
        for (var obi = 0; obi < obstacles.length; obi++) {
          var ob2 = obstacles[obi];
          if (segmentIntersectsBox(p1, p2, ob2)) {
            // Reroute around the obstacle: go around the closer side
            var goRight = (p1.x + p2.x) / 2 >= (ob2.l + ob2.r) / 2;
            var bypassX = goRight ? ob2.r : ob2.l;
            if (p1.x === p2.x) {
              // Vertical segment hitting a box: jog horizontally around it
              newPoints.push({ x: p1.x, y: Math.min(p1.y, ob2.t) });
              newPoints.push({ x: bypassX, y: Math.min(p1.y, ob2.t) });
              newPoints.push({ x: bypassX, y: Math.max(p2.y, ob2.b) });
              newPoints.push({ x: p2.x, y: Math.max(p2.y, ob2.b) });
            } else {
              // Horizontal segment hitting a box: jog vertically around it
              var goDown = (p1.y + p2.y) / 2 >= (ob2.t + ob2.b) / 2;
              var bypassY = goDown ? ob2.b : ob2.t;
              newPoints.push({ x: Math.min(p1.x, ob2.l), y: p1.y });
              newPoints.push({ x: Math.min(p1.x, ob2.l), y: bypassY });
              newPoints.push({ x: Math.max(p2.x, ob2.r), y: bypassY });
              newPoints.push({ x: Math.max(p2.x, ob2.r), y: p2.y });
            }
            rerouted = true;
            break;
          }
        }
        if (!rerouted) {
          newPoints.push(p2);
        } else {
          newPoints.push(p2);
        }
      }
      points = simplifyPath(newPoints);
    }

    return { points: points };
  }

  /**
   * Check if a line segment (p1→p2) intersects a rectangle {l, t, r, b}.
   */
  function segmentIntersectsBox(p1, p2, box) {
    // Segment bounding box must overlap the obstacle box
    var sMinX = Math.min(p1.x, p2.x), sMaxX = Math.max(p1.x, p2.x);
    var sMinY = Math.min(p1.y, p2.y), sMaxY = Math.max(p1.y, p2.y);
    if (sMaxX <= box.l || sMinX >= box.r || sMaxY <= box.t || sMinY >= box.b) return false;
    // For axis-aligned segments (orthogonal), bbox overlap means intersection
    if (p1.x === p2.x || p1.y === p2.y) return true;
    // For diagonal segments, do full Liang-Barsky clip test
    return true;
  }

  /**
   * Remove redundant points in an orthogonal path
   * (consecutive points on the same horizontal or vertical line).
   */
  function simplifyPath(points) {
    if (points.length <= 2) return points;
    var result = [points[0]];
    for (var i = 1; i < points.length - 1; i++) {
      var prev = result[result.length - 1];
      var curr = points[i];
      var next = points[i + 1];
      // Skip if all three are on the same horizontal or vertical line
      if ((prev.x === curr.x && curr.x === next.x) ||
          (prev.y === curr.y && curr.y === next.y)) {
        continue;
      }
      result.push(curr);
    }
    result.push(points[points.length - 1]);
    return result;
  }

  /**
   * Draw a diamond (filled or hollow) at position (x,y) pointing along (ux,uy).
   */
  function drawDiamond(svg, x, y, ux, uy, px, py, color, filled, bgColor) {
    var dh = CFG.diamondH;
    var dw = CFG.diamondW / 2;
    var p1x = x, p1y = y;
    var p2x = x + ux * dh / 2 + px * dw, p2y = y + uy * dh / 2 + py * dw;
    var p3x = x + ux * dh, p3y = y + uy * dh;
    var p4x = x + ux * dh / 2 - px * dw, p4y = y + uy * dh / 2 - py * dw;

    svg.push('<polygon points="' +
      p1x + ',' + p1y + ' ' + p2x + ',' + p2y + ' ' +
      p3x + ',' + p3y + ' ' + p4x + ',' + p4y +
      '" fill="' + (filled ? color : (bgColor || '#fff')) + '" stroke="' + color + '" stroke-width="' + CFG.strokeWidth + '"/>');
  }

  /**
   * Draw an open arrowhead at position (x,y) pointing along (ux,uy).
   */
  function drawOpenArrow(svg, x, y, ux, uy, px, py, color) {
    var as = CFG.arrowSize;
    var hw = as * 0.4;
    var tipX = x, tipY = y;
    var l1x = x + ux * as + px * hw, l1y = y + uy * as + py * hw;
    var l2x = x + ux * as - px * hw, l2y = y + uy * as - py * hw;

    svg.push('<polyline points="' +
      l1x + ',' + l1y + ' ' + tipX + ',' + tipY + ' ' + l2x + ',' + l2y +
      '" fill="none" stroke="' + color + '" stroke-width="' + CFG.strokeWidth + '"/>');
  }

  // ─── Public API ───────────────────────────────────────────────────

  /**
   * Render a UML class diagram from text format into a container element.
   * @param {HTMLElement} container - Target DOM element
   * @param {string} text - Diagram specification in the custom text format
   * @param {Object} [options] - Optional overrides
   */
  function render(container, text, options) {
    var parsed = parse(text);
    renderFromData(container, parsed, options);
  }

  /**
   * Render a UML class diagram from pre-parsed data into a container element.
   * @param {HTMLElement} container - Target DOM element
   * @param {Object} parsed - Output from parse()
   * @param {Object} [options] - Optional overrides
   */
  function renderFromData(container, parsed, options) {
    if (!parsed.classes || parsed.classes.length === 0) {
      container.innerHTML = '<div style="padding:20px;color:#888;text-align:center;">No classes to display.</div>';
      return;
    }

    // Ensure container has the CSS class for theming
    if (!container.classList.contains('uml-class-diagram-container')) {
      container.classList.add('uml-class-diagram-container');
    }

    var colors = UMLShared.getThemeColors(container);
    colors.bg = window.getComputedStyle(container).getPropertyValue('--uml-bg').trim() || 'transparent';
    var layout = computeLayout(parsed);
    var svgStr = generateSVG(layout, parsed, colors);
    container.innerHTML = svgStr;
    UMLShared.autoFitSVG(container);
  }

  // ─── Auto-init for SEBook pages ───────────────────────────────────

  /**
   * Extract raw diagram text from a <code> element.
   * Uses innerHTML so that <<stereotype>> notation written in raw HTML
   * (where the browser parses <stereotype> as an element) is recovered
   * correctly instead of being silently dropped by textContent.
   */
  function extractCodeText(el) {
    var html = el.innerHTML;
    // Browser may parse <<Foo>> as: &lt; + <Foo> element + &gt; + …
    // Restore element tag names as literal text, then decode entities.
    html = html
      .replace(/<\/[a-zA-Z][a-zA-Z0-9]*\s*>/g, '')                         // drop </tag>
      .replace(/<([a-zA-Z][a-zA-Z0-9]*)(?:\s[^>]*)?>/g, '<$1>')            // <tag attrs> → <tag>
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); // decode entities
    return html;
  }

  UMLShared.createAutoInit('pre > code.language-uml-class', render, { extractText: extractCodeText });

  // ─── Export ────────────────────────────────────────────────────────

  window.UMLClassDiagram = {
    render: render,
    renderFromData: renderFromData,
    parse: parse,
  };

})();
