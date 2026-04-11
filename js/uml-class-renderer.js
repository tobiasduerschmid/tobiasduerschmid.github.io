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
    fontSizeStereotype: 12,
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
    var inClass = null;
    var braceDepth = 0;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line === '@startuml' || line === '@enduml') continue;

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

    return { classes: classes, relationships: relationships };
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
    var hasStereotype = cls.type === 'abstract' || cls.type === 'interface' || cls.stereotype;
    var stereotypeText = '';
    if (cls.stereotype) stereotypeText = '\u00AB' + cls.stereotype + '\u00BB';
    else if (cls.type === 'abstract') stereotypeText = '\u00ABabstract\u00BB';
    else if (cls.type === 'interface') stereotypeText = '\u00ABinterface\u00BB';

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
   * Build a directed layout graph using ALL directed relationship types.
   * Generalization/realization: child -> parent (child below parent)
   * Composition/aggregation: owner above owned
   * Dependency/navigable: source above target
   */
  function buildLayoutGraph(classes, relationships) {
    var classNames = {};
    for (var i = 0; i < classes.length; i++) classNames[classes[i].name] = true;

    // Directed edges: from "upper" node to "lower" node
    // parent -> [children] for layout purposes
    var downEdges = {};   // upper -> [lower]
    var upEdges = {};     // lower -> [upper]
    for (var n in classNames) { downEdges[n] = []; upEdges[n] = []; }

    for (var r = 0; r < relationships.length; r++) {
      var rel = relationships[r];
      if (!classNames[rel.from] || !classNames[rel.to]) continue;

      var upper, lower;
      if (rel.type === 'generalization' || rel.type === 'realization') {
        upper = rel.to;   // parent above
        lower = rel.from; // child below
      } else if (rel.type === 'composition' || rel.type === 'aggregation') {
        upper = rel.from; // owner above
        lower = rel.to;   // owned below
      } else if (rel.type === 'dependency' || rel.type === 'navigable') {
        upper = rel.from; // source above
        lower = rel.to;   // target below
      } else {
        continue; // plain association — no direction preference
      }

      if (upper === lower) continue;
      // Avoid duplicate edges
      if (downEdges[upper].indexOf(lower) === -1) {
        downEdges[upper].push(lower);
        upEdges[lower].push(upper);
      }
    }

    return { downEdges: downEdges, upEdges: upEdges };
  }

  /**
   * Assign layers via longest-path from roots (Sugiyama-style).
   * Handles cycles by skipping back-edges.
   */
  function assignLayers(classes, downEdges, upEdges) {
    var classNames = {};
    for (var i = 0; i < classes.length; i++) classNames[classes[i].name] = true;

    // Find roots (no incoming layout edges)
    var roots = [];
    for (var n in classNames) {
      if (upEdges[n].length === 0) roots.push(n);
    }
    if (roots.length === 0) {
      // All nodes have incoming edges (cycle) — pick all as roots
      roots = Object.keys(classNames);
    }

    // BFS layer assignment — longest path
    var layers = {};
    var visited = {};
    var queue = [];
    for (var ri = 0; ri < roots.length; ri++) {
      if (visited[roots[ri]]) continue;
      layers[roots[ri]] = 0;
      visited[roots[ri]] = true;
      queue.push(roots[ri]);
    }
    while (queue.length > 0) {
      var node = queue.shift();
      var kids = downEdges[node];
      for (var ki = 0; ki < kids.length; ki++) {
        var kid = kids[ki];
        var newLayer = (layers[node] || 0) + 1;
        if (!visited[kid]) {
          visited[kid] = true;
          layers[kid] = newLayer;
          queue.push(kid);
        } else {
          // Push deeper if needed (longest path)
          if (newLayer > layers[kid]) {
            layers[kid] = newLayer;
            queue.push(kid); // re-process children
          }
        }
      }
    }

    // Assign any remaining unvisited to layer 0
    for (var n2 in classNames) {
      if (layers[n2] === undefined) layers[n2] = 0;
    }

    return layers;
  }

  /**
   * Compute layout positions for all class boxes.
   * Uses all directed relationships for hierarchy and arranges
   * disconnected components in a compact grid.
   */
  function computeLayout(parsed) {
    var classes = parsed.classes;
    var relationships = parsed.relationships;
    if (classes.length === 0) return { entries: {}, width: 0, height: 0 };

    // Measure all boxes
    var entries = {};
    for (var i = 0; i < classes.length; i++) {
      var cls = classes[i];
      entries[cls.name] = {
        cls: cls,
        box: measureBox(cls),
        x: 0,
        y: 0,
      };
    }

    var graph = buildLayoutGraph(classes, relationships);
    var layers = assignLayers(classes, graph.downEdges, graph.upEdges);

    // Build layout tree: assign each child to one parent for tree positioning
    // Inheritance children are centered under parent; other children placed to the sides
    var layoutChildren = {};
    var inheritChildren = {}; // Track which children are via inheritance
    var assigned = {};
    for (var n in entries) { layoutChildren[n] = []; inheritChildren[n] = {}; }

    // First pass: assign inheritance (generalization/realization) children
    for (var r = 0; r < relationships.length; r++) {
      var rel = relationships[r];
      if (rel.type !== 'generalization' && rel.type !== 'realization') continue;
      if (!entries[rel.from] || !entries[rel.to]) continue;
      var upper = rel.to, lower = rel.from;
      if (upper === lower) continue;
      if (!assigned[lower]) {
        layoutChildren[upper].push(lower);
        inheritChildren[upper][lower] = true;
        assigned[lower] = upper;
      }
    }

    // Second pass: assign other directed children (composition, aggregation, etc.)
    var otherPriority = ['composition', 'aggregation', 'navigable', 'dependency'];
    for (var pi = 0; pi < otherPriority.length; pi++) {
      for (var r2 = 0; r2 < relationships.length; r2++) {
        var rel2 = relationships[r2];
        if (rel2.type !== otherPriority[pi]) continue;
        if (!entries[rel2.from] || !entries[rel2.to]) continue;
        var upper2, lower2;
        if (rel2.type === 'composition' || rel2.type === 'aggregation') {
          upper2 = rel2.from; lower2 = rel2.to;
        } else {
          upper2 = rel2.from; lower2 = rel2.to;
        }
        if (upper2 === lower2) continue;
        if (!assigned[lower2]) {
          layoutChildren[upper2].push(lower2);
          assigned[lower2] = upper2;
        }
      }
    }

    // ── Barycenter sibling ordering ────────────────────────────────────
    // For each parent node, sort its children by the original class-index
    // centroid of the nodes they are connected to. This places children
    // whose connections fan out to the left/right of the diagram in the
    // appropriate order, reducing edge crossings between subtrees.
    var classIndex = {};
    for (var bci = 0; bci < classes.length; bci++) classIndex[classes[bci].name] = bci;
    for (var bcParent in layoutChildren) {
      var bcKids = layoutChildren[bcParent];
      if (!bcKids || bcKids.length < 2) continue;
      var bcBary = {};
      for (var bcKi = 0; bcKi < bcKids.length; bcKi++) {
        var bcKid = bcKids[bcKi];
        var bcSum = 0, bcCnt = 0;
        for (var bcRi = 0; bcRi < relationships.length; bcRi++) {
          var bcRel = relationships[bcRi];
          var bcOther = null;
          if (bcRel.from === bcKid && entries[bcRel.to]) bcOther = bcRel.to;
          else if (bcRel.to === bcKid && entries[bcRel.from]) bcOther = bcRel.from;
          if (bcOther !== null && classIndex[bcOther] !== undefined) {
            bcSum += classIndex[bcOther]; bcCnt++;
          }
        }
        // Fall back to the kid's own original index
        bcBary[bcKid] = bcCnt > 0 ? bcSum / bcCnt : (classIndex[bcKid] || 0);
      }
      bcKids.sort(function (a, b) { return bcBary[a] - bcBary[b]; });
    }

    // Find connected components using adjacency (undirected)
    var adjAll = {};
    for (var cn in entries) adjAll[cn] = [];
    for (var ri = 0; ri < relationships.length; ri++) {
      var rr = relationships[ri];
      if (entries[rr.from] && entries[rr.to]) {
        if (adjAll[rr.from].indexOf(rr.to) === -1) adjAll[rr.from].push(rr.to);
        if (adjAll[rr.to].indexOf(rr.from) === -1) adjAll[rr.to].push(rr.from);
      }
    }
    var componentOf = {};
    var components = []; // array of arrays of class names
    var compVisited = {};
    for (var ci = 0; ci < classes.length; ci++) {
      var startName = classes[ci].name;
      if (compVisited[startName]) continue;
      var comp = [];
      var bfsQ = [startName];
      compVisited[startName] = true;
      while (bfsQ.length > 0) {
        var cur = bfsQ.shift();
        comp.push(cur);
        componentOf[cur] = components.length;
        var neighbors = adjAll[cur];
        for (var ni = 0; ni < neighbors.length; ni++) {
          if (!compVisited[neighbors[ni]]) {
            compVisited[neighbors[ni]] = true;
            bfsQ.push(neighbors[ni]);
          }
        }
      }
      components.push(comp);
    }

    // Compute minimum gap based on relationship label/multiplicity widths.
    // The gap must fit: [fromMult margin] [label text] [toMult margin]
    var effectiveGapX = CFG.gapX;
    for (var rg = 0; rg < relationships.length; rg++) {
      var rgRel = relationships[rg];
      var neededW = 0;
      // Label text centered in the gap needs full width + margins
      if (rgRel.label) {
        neededW = Math.max(neededW, UMLShared.textWidth(rgRel.label, false, CFG.fontSizeStereotype) + 40);
      }
      // Multiplicities sit near endpoints — each needs space
      var multW = 0;
      if (rgRel.fromMult) multW += UMLShared.textWidth(rgRel.fromMult, false, CFG.fontSizeStereotype) + 12;
      if (rgRel.toMult) multW += UMLShared.textWidth(rgRel.toMult, false, CFG.fontSizeStereotype) + 12;
      neededW = Math.max(neededW, multW + 20);
      effectiveGapX = Math.max(effectiveGapX, neededW);
    }

    // For each component, find its layout roots and compute tree layout
    var subtreeW = {};
    function computeSubtreeWidth(name) {
      if (subtreeW[name] !== undefined) return subtreeW[name];
      var kids = layoutChildren[name];
      if (!kids || kids.length === 0) {
        subtreeW[name] = entries[name].box.width;
        return subtreeW[name];
      }
      // Compute total width of all children
      var total = 0;
      for (var k = 0; k < kids.length; k++) {
        total += computeSubtreeWidth(kids[k]);
        if (k < kids.length - 1) total += effectiveGapX;
      }
      // Ensure parent box width plus padding for centered inheritance
      subtreeW[name] = Math.max(entries[name].box.width, total);
      return subtreeW[name];
    }

    function positionNode(name, left, top) {
      var entry = entries[name];
      var sw = subtreeW[name];
      entry.x = left + (sw - entry.box.width) / 2;
      entry.y = top;

      var kids = layoutChildren[name];
      if (!kids || kids.length === 0) return;

      // Separate inheritance children from other children
      var inhKids = [];
      var otherKids = [];
      for (var k = 0; k < kids.length; k++) {
        if (inheritChildren[name] && inheritChildren[name][kids[k]]) {
          inhKids.push(kids[k]);
        } else {
          otherKids.push(kids[k]);
        }
      }

      var childY = top + entry.box.height + CFG.gapY;
      var parentCx = entry.x + entry.box.width / 2;

      // Position inheritance children centered under parent
      if (inhKids.length > 0) {
        var inhTotalW = 0;
        for (var ik = 0; ik < inhKids.length; ik++) {
          inhTotalW += subtreeW[inhKids[ik]];
          if (ik < inhKids.length - 1) inhTotalW += effectiveGapX;
        }
        var inhLeft = parentCx - inhTotalW / 2;
        for (var ik2 = 0; ik2 < inhKids.length; ik2++) {
          positionNode(inhKids[ik2], inhLeft, childY);
          inhLeft += subtreeW[inhKids[ik2]] + effectiveGapX;
        }
      }

      // Position other children (composition, etc.) to the right of inheritance children
      if (otherKids.length > 0) {
        // Find the rightmost edge of inheritance children
        var otherStartX = parentCx + (inhKids.length > 0 ? subtreeW[inhKids[inhKids.length - 1]] / 2 : 0) + effectiveGapX;
        // Or if inheritance children span far left, start after them
        if (inhKids.length > 0) {
          var inhRight = -Infinity;
          for (var ir = 0; ir < inhKids.length; ir++) {
            var irEntry = entries[inhKids[ir]];
            inhRight = Math.max(inhRight, irEntry.x + irEntry.box.width + effectiveGapX);
          }
          otherStartX = Math.max(otherStartX, inhRight);
        } else {
          otherStartX = left;
        }
        for (var ok = 0; ok < otherKids.length; ok++) {
          positionNode(otherKids[ok], otherStartX, childY);
          otherStartX += subtreeW[otherKids[ok]] + effectiveGapX;
        }
      }
    }

    // Layout each component, then arrange components in a grid
    var componentBounds = []; // { width, height } per component
    for (var ci2 = 0; ci2 < components.length; ci2++) {
      var comp = components[ci2];

      // Find roots of this component (not assigned as child)
      var compRoots = [];
      for (var j = 0; j < comp.length; j++) {
        if (!assigned[comp[j]]) compRoots.push(comp[j]);
      }
      if (compRoots.length === 0) compRoots = [comp[0]];

      // Layout roots side by side within component
      var compX = 0;
      for (var cri = 0; cri < compRoots.length; cri++) {
        computeSubtreeWidth(compRoots[cri]);
        positionNode(compRoots[cri], compX, 0);
        compX += subtreeW[compRoots[cri]] + effectiveGapX;
      }

      // Compute component bounds
      var cMinX = Infinity, cMinY = Infinity, cMaxX = -Infinity, cMaxY = -Infinity;
      for (var k = 0; k < comp.length; k++) {
        var e = entries[comp[k]];
        cMinX = Math.min(cMinX, e.x);
        cMinY = Math.min(cMinY, e.y);
        cMaxX = Math.max(cMaxX, e.x + e.box.width);
        cMaxY = Math.max(cMaxY, e.y + e.box.height);
      }
      componentBounds.push({
        width: cMaxX - cMinX,
        height: cMaxY - cMinY,
        offsetX: cMinX,
        offsetY: cMinY,
        members: comp,
      });
    }

    // Arrange components: place larger components first, pack into rows
    // Sort components by height (tallest first) for better packing
    var compIndices = [];
    for (var si = 0; si < components.length; si++) compIndices.push(si);
    compIndices.sort(function (a, b) {
      return componentBounds[b].height - componentBounds[a].height;
    });

    // Simple row-based packing
    var maxRowWidth = 0;
    for (var mi = 0; mi < componentBounds.length; mi++) {
      maxRowWidth += componentBounds[mi].width + CFG.gapX;
    }
    // Target width: try to make it roughly square, but at least as wide as largest component
    var targetWidth = Math.max(
      Math.sqrt(maxRowWidth * (componentBounds.length > 0 ? componentBounds[0].height : 100)),
      componentBounds.length > 0 ? componentBounds[compIndices[0]].width : 0
    );

    var rowX = 0, rowY = 0, rowMaxH = 0;
    for (var pi2 = 0; pi2 < compIndices.length; pi2++) {
      var cidx = compIndices[pi2];
      var cb = componentBounds[cidx];

      // Start new row if this component would exceed target width
      if (rowX > 0 && rowX + cb.width > targetWidth) {
        rowX = 0;
        rowY += rowMaxH + CFG.gapY;
        rowMaxH = 0;
      }

      // Offset all members of this component
      var dx = rowX - cb.offsetX;
      var dy = rowY - cb.offsetY;
      for (var mi2 = 0; mi2 < cb.members.length; mi2++) {
        entries[cb.members[mi2]].x += dx;
        entries[cb.members[mi2]].y += dy;
      }

      rowX += cb.width + CFG.gapX;
      rowMaxH = Math.max(rowMaxH, cb.height);
    }

    // Compute total bounds
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var en in entries) {
      var e2 = entries[en];
      minX = Math.min(minX, e2.x);
      minY = Math.min(minY, e2.y);
      maxX = Math.max(maxX, e2.x + e2.box.width);
      maxY = Math.max(maxY, e2.y + e2.box.height);
    }

    return {
      entries: entries,
      width: maxX - minX,
      height: maxY - minY,
      offsetX: -minX,
      offsetY: -minY,
    };
  }

  // ─── SVG Renderer ─────────────────────────────────────────────────



  /**
   * Generate full SVG string from layout and relationships.
   */
  function generateSVG(layout, parsed, colors) {
    var entries = layout.entries;
    var relationships = parsed.relationships;
    var ox = layout.offsetX + CFG.svgPad;
    var oy = layout.offsetY + CFG.svgPad;
    var svgW = layout.width + CFG.svgPad * 2;
    var svgH = layout.height + CFG.svgPad * 2;

    var svg = [];
    svg.push(UMLShared.svgOpen(svgW, svgH, ox, oy, CFG.fontFamily));

    // ── Draw relationships ──

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

    // Draw inheritance/realization with shared-target style
    for (var gk in inheritGroups) {
      var group = inheritGroups[gk];
      var parentEntry = entries[group.target];
      var isDashed = group.type === 'realization';
      var dashAttr = isDashed ? ' stroke-dasharray="8,4"' : '';

      var parentCx = parentEntry.x + parentEntry.box.width / 2;
      var parentBot = parentEntry.y + parentEntry.box.height;

      // Hollow triangle at parent bottom
      var triTop = parentBot;
      var triBot = parentBot + CFG.triangleH;
      svg.push('<polygon points="' +
        parentCx + ',' + triTop + ' ' +
        (parentCx - CFG.triangleW / 2) + ',' + triBot + ' ' +
        (parentCx + CFG.triangleW / 2) + ',' + triBot +
        '" fill="' + colors.fill + '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"/>');

      if (group.children.length === 1) {
        // Single child: straight line (or angled if not aligned)
        var child = entries[group.children[0]];
        var childCx = child.x + child.box.width / 2;
        var childTop = child.y;
        svg.push('<line x1="' + parentCx + '" y1="' + triBot + '" x2="' + childCx + '" y2="' + childTop +
          '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');
      } else {
        // Multiple children: shared-target
        var childTops = [];
        var childCenters = [];
        for (var ci = 0; ci < group.children.length; ci++) {
          var ch = entries[group.children[ci]];
          childCenters.push(ch.x + ch.box.width / 2);
          childTops.push(ch.y);
        }
        var minChildTop = Math.min.apply(null, childTops);
        var junctionY = (triBot + minChildTop) / 2;

        // Trunk: triangle bottom to junction
        svg.push('<line x1="' + parentCx + '" y1="' + triBot + '" x2="' + parentCx + '" y2="' + junctionY +
          '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');

        // Horizontal bar at junction
        var leftCx = Math.min.apply(null, childCenters);
        var rightCx = Math.max.apply(null, childCenters);
        svg.push('<line x1="' + leftCx + '" y1="' + junctionY + '" x2="' + rightCx + '" y2="' + junctionY +
          '" stroke="' + colors.line + '" stroke-width="' + CFG.strokeWidth + '"' + dashAttr + '/>');

        // Vertical stems from junction to each child
        for (var ci2 = 0; ci2 < group.children.length; ci2++) {
          var ch2 = entries[group.children[ci2]];
          var cx = ch2.x + ch2.box.width / 2;
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
      var epSide = (hasInheritAtBottom[epRel.from]) ? 'right' :
        (Math.abs(epTo.x + epTo.box.width/2 - epFrom.x - epFrom.box.width/2) >
         Math.abs(epTo.y + epTo.box.height/2 - epFrom.y - epFrom.box.height/2) * 0.6) ?
        ((epTo.x > epFrom.x) ? 'right' : 'left') :
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
      var route = computeOrthogonalRoute(fromE, toE, hasInheritAtBottom[orel.from], hasInheritAtTop[orel.to], portOffset);
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

      // Source decorations
      if (orel.type === 'composition') {
        drawDiamond(svg, p0.x, p0.y, startDx, startDy, -startDy, startDx, colors.line, true, colors.fill);
      } else if (orel.type === 'aggregation') {
        drawDiamond(svg, p0.x, p0.y, startDx, startDy, -startDy, startDx, colors.line, false, colors.fill);
      }

      // Target decorations
      if (orel.type === 'navigable' || orel.type === 'dependency') {
        drawOpenArrow(svg, pLast.x, pLast.y, -endDx, -endDy, endDy, -endDx, colors.line);
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
          'stroke="' + colors.fill + '" stroke-width="4" stroke-linejoin="round" paint-order="stroke" ' +
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
          'stroke="' + colors.fill + '" stroke-width="4" stroke-linejoin="round" paint-order="stroke">' +
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
          'stroke="' + colors.fill + '" stroke-width="4" stroke-linejoin="round" paint-order="stroke">' +
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

    svg.push(UMLShared.svgClose());
    return svg.join('\n');
  }

  /**
   * Compute orthogonal (Manhattan) route between two class boxes.
   * Prefers straight lines when boxes are aligned vertically or horizontally.
   * Uses right-angle bends only when necessary.
   * Returns { points: [{x,y}, ...] } with only horizontal/vertical segments.
   */
  function computeOrthogonalRoute(fromE, toE, avoidFromBottom, avoidToTop, portOffset) {
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
      // Exit from the side closest to the target
      var exitSide = (toCx > fromCx) ? 'right' : 'left';
      var exitX = (exitSide === 'right') ? fromR : fromL;
      var exitY = fromCy;
      var entryY = toCy;
      var entryX = (toCx > fromCx) ? toL : toR;

      // If target is below and source center is above target top, enter from top with a
      // vertical last segment (90-degree entry). Route: horizontal to toCx, then drop into toT.
      if (toCy > fromCy && !avoidToTop && exitY < toT) {
        points = [
          { x: exitX, y: exitY },
          { x: toCx, y: exitY },
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
      return { points: simplifyPath(points) };
    }

    if (hOverlap && !avoidFromBottom) {
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

    return { points: points };
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
