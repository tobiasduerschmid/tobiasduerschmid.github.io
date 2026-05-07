/**
 * MakeGraph — SVG-based dependency-graph visualization for GNU Make
 *
 * Renders the dependency DAG that `make` would walk: targets, prerequisites,
 * order-only prerequisites, phony targets, and (when timestamps are
 * available) which targets are out-of-date — i.e. exactly what `make -n`
 * would rebuild.
 *
 * Designed as the analog of GitGraph for tutorials whose YAML sets
 *   make_dag: /path/to/dir
 * The TutorialCode runtime calls `make -pn` in v86, dumps the parseable
 * database to a state file, hands the text to `MakeGraph.parseMakeDb`,
 * and feeds the resulting `{ nodes, edges }` to `makeGraph.render(data)`.
 *
 * Visual contract:
 *   - Source files (no recipe) → no border, gray text
 *   - Target, up-to-date         → green left border, ✓ glyph
 *   - Target, stale              → red left border, gentle pulse
 *   - Phony target               → dashed border, dotted-circle glyph
 *   - Order-only edges           → dashed line
 *   - Normal edges               → solid arrow target → prereq
 *
 * Layout: top-down hierarchical (Sugiyama-style longest-path layering).
 * Roots (final targets like `app`) sit at the top; sources at the bottom.
 *
 * Pedagogical hooks:
 *   - hover: tooltip with recipe text + last-modified time
 *   - click: emits 'make-graph:node-click' on the container so the host
 *     can jump to the rule in the editor
 *   - reduced-motion preference disables every animation
 */
(function () {
  'use strict';

  function prefersReducedMotion() {
    if (typeof window.__prefersReducedMotion === 'function') {
      return window.__prefersReducedMotion();
    }
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Parser — converts `make -pn` text dump → structured graph data.
  // ---------------------------------------------------------------------------

  /**
   * Parse the text emitted by:
   *
   *   ( cd <dir>
   *     && echo "===FILES==="
   *     && make -pn --no-builtin-rules 2>/dev/null
   *     && echo "===PHONY==="
   *     && grep -E '^\.PHONY' Makefile 2>/dev/null
   *     && echo "===MTIMES==="
   *     && find . -maxdepth 1 -type f -printf '%f|%T@\n' 2>/dev/null
   *   )
   *
   * Returns: { nodes: [...], edges: [...], errors: [...], makefilePresent: bool }
   *
   *   nodes[i] = { id, isPhony, isSource, isStale, recipe, mtime, line }
   *   edges[j] = { from, to, kind: 'normal' | 'order-only' }
   */
  function parseMakeDb(dumpText) {
    var sections = { FILES: '', PHONY: '', MTIMES: '', ERRORS: '' };
    var rest = dumpText || '';
    // Split on section markers. Using `String.prototype.split` with a
    // capture-group regex returns alternating
    // [pre-text, name1, content1, name2, content2, ...]
    // which avoids the (notorious) `regex.exec` non-global infinite loop
    // bug we'd hit if we tried to walk matches by hand.
    var parts = rest.split(/^===(\w+)===\s*$\n?/m);
    // parts[0] is anything before the first marker (we ignore it).
    // parts[1], parts[2] = name, content of first section. Then alternate.
    for (var pi = 1; pi + 1 < parts.length; pi += 2) {
      var name = parts[pi];
      var body = parts[pi + 1] || '';
      if (sections.hasOwnProperty(name)) {
        sections[name] = body;
      }
    }

    var phonySet = parsePhony(sections.PHONY || '');
    var mtimes = parseMtimes(sections.MTIMES || '');
    var parsed = parseFilesSection(sections.FILES || '');

    // Stamp phony + mtime + staleness onto each node.
    var nodesById = {};
    for (var i = 0; i < parsed.nodes.length; i++) {
      var n = parsed.nodes[i];
      n.isPhony = phonySet[n.id] === true;
      if (mtimes[n.id] !== undefined) n.mtime = mtimes[n.id];
      nodesById[n.id] = n;
    }
    // Some prerequisites are leaf source files Make's database doesn't
    // explicitly enumerate as targets. Add them as orphan source nodes
    // so the edges still have something to point at.
    for (var j = 0; j < parsed.edges.length; j++) {
      var e = parsed.edges[j];
      if (!nodesById[e.to]) {
        var leaf = {
          id: e.to,
          isPhony: phonySet[e.to] === true,
          isSource: true,
          isStale: false,
          recipe: '',
          mtime: mtimes[e.to],
          line: null,
        };
        parsed.nodes.push(leaf);
        nodesById[e.to] = leaf;
      }
    }

    computeStaleness(parsed.nodes, parsed.edges, nodesById);

    return {
      nodes: parsed.nodes,
      edges: parsed.edges,
      errors: parsed.errors,
      makefilePresent: parsed.makefilePresent,
    };
  }

  function parsePhony(text) {
    var set = {};
    var lines = (text || '').split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      var m = /^\.PHONY\s*:\s*(.*)$/.exec(line);
      if (!m) continue;
      var names = m[1].split(/\s+/);
      for (var j = 0; j < names.length; j++) {
        var n = names[j].trim();
        if (n) set[n] = true;
      }
    }
    return set;
  }

  function parseMtimes(text) {
    var out = {};
    var lines = (text || '').split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      // We dumped with `find -printf '%f|%T@\n'`, so each line is
      // "filename|epoch_seconds_with_decimals" — and ./ leading paths
      // are already stripped by %f.
      var pipe = line.lastIndexOf('|');
      if (pipe < 0) continue;
      var name = line.substring(0, pipe).trim();
      var t = parseFloat(line.substring(pipe + 1));
      if (!name || isNaN(t)) continue;
      out[name] = t;
    }
    return out;
  }

  /**
   * Parse the "# Files" section from `make -p` output.
   *
   * Each entry has the rough shape:
   *
   *   main.o: main.c math.h
   *   #  Implicit rule search has been done.
   *   #  Last modified 2026-05-07 12:34:56
   *   #  Recipe to execute (from 'Makefile', line 9):
   *   	gcc -c main.c -o main.o
   *
   * "# Not a target:" precedes source files Make discovered. We capture
   * those nodes too so the graph shows leaves with their mtime.
   */
  function parseFilesSection(filesText) {
    var nodes = [];
    var edges = [];
    var errors = [];
    var seenTargets = {};

    // Split the # Files section into top-level entries. Each entry begins
    // with an unindented line (target name) and ends at the next unindented
    // line. We skip non-entry lines (blank, comment-only, hash-table stats).
    //
    // Special case: `make -p` precedes source files (and other "non-target"
    // pseudo-entries) with a standalone `# Not a target:` comment line:
    //
    //   # Not a target:
    //   main.c:
    //   #  Last modified ...
    //
    // We track a `pendingNotATarget` flag during the walk so the comment
    // attaches to the *following* entry, not the preceding one — and we
    // strip the comment line out of the body so it doesn't contaminate
    // recipe text or trip the `Not a target` regex on the wrong entry.
    var lines = (filesText || '').split('\n');
    var entries = [];
    var current = null;
    var pendingNotATarget = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^# Not a target:\s*$/.test(line)) {
        pendingNotATarget = true;
        continue;
      }
      // A target line starts at column 0, contains a colon, and is not a
      // pure comment. Variable assignments contain '=' before any colon
      // and are skipped.
      if (/^[^\s#].*:/.test(line) && !/^[^\s#][^=:]*=/.test(line)) {
        if (current) entries.push(current);
        current = { header: line, body: '', isNotATarget: pendingNotATarget };
        pendingNotATarget = false;
      } else if (current) {
        current.body += line + '\n';
      }
    }
    if (current) entries.push(current);

    for (var k = 0; k < entries.length; k++) {
      var entry = entries[k];
      var headerMatch = /^(\S[^:]*):\s*(.*)$/.exec(entry.header);
      if (!headerMatch) continue;
      var target = headerMatch[1].trim();
      var prereqs = headerMatch[2];

      // Filter Make's pseudo-targets (they don't help students) and
      // anything containing a `%` (pattern stems Make has expanded into
      // concrete entries elsewhere — keeping the abstract one would
      // double-count).
      if (/^\.[A-Z]+/.test(target) && target !== '.PHONY') continue;
      if (target.indexOf('%') >= 0) continue;
      if (target === '' || /\s/.test(target)) continue;

      var isNotTarget = !!entry.isNotATarget;
      var lastMod = (entry.body.match(/Last modified[^\n]*?(\d[\d\-:.\s]+)/) || [])[1];
      // Recipe lines are tab-indented continuations starting with \t.
      // They appear after "Recipe to execute" (or in plain output form).
      var recipeMatch = entry.body.match(/Recipe to execute[^\n]*\n((?:\t.*\n?)+)/);
      var recipe = recipeMatch ? recipeMatch[1].replace(/^\t/gm, '').trim() : '';
      // The Makefile line where this rule was declared, for click-to-jump.
      var lineMatch = entry.body.match(/from '[^']*', line (\d+)/);
      var srcLine = lineMatch ? parseInt(lineMatch[1], 10) : null;

      if (!seenTargets[target]) {
        nodes.push({
          id: target,
          isPhony: false,                // overlaid later
          isSource: isNotTarget,
          isStale: false,                // overlaid later
          recipe: recipe,
          mtime: parseTimestamp(lastMod),
          line: srcLine,
        });
        seenTargets[target] = true;
      }

      // Parse prerequisites: split around '|' for normal vs order-only.
      var parts = prereqs.split('|');
      var normal = (parts[0] || '').trim().split(/\s+/).filter(Boolean);
      var orderOnly = (parts[1] || '').trim().split(/\s+/).filter(Boolean);
      for (var ni = 0; ni < normal.length; ni++) {
        if (normal[ni].indexOf('%') < 0) {
          edges.push({ from: target, to: normal[ni], kind: 'normal' });
        }
      }
      for (var oi = 0; oi < orderOnly.length; oi++) {
        if (orderOnly[oi].indexOf('%') < 0) {
          edges.push({ from: target, to: orderOnly[oi], kind: 'order-only' });
        }
      }
    }

    // Detect the "no Makefile" case: empty section + zero entries.
    var makefilePresent = entries.length > 0;
    return { nodes: nodes, edges: edges, errors: errors, makefilePresent: makefilePresent };
  }

  function parseTimestamp(s) {
    if (!s) return undefined;
    s = s.trim();
    // `make -p` prints e.g. "2026-05-07 12:34:56" — JS Date can parse it
    // when we replace the space with 'T'.
    var iso = s.replace(' ', 'T');
    var t = Date.parse(iso);
    return isNaN(t) ? undefined : t / 1000;
  }

  /**
   * Mark each non-source node as stale if it's older than at least one
   * of its prerequisites (transitively). Mirrors what `make -n` would
   * rebuild — without actually invoking make.
   *
   * Two-pass strategy:
   *   1. Direct staleness: for each non-source target, compare mtimes with
   *      its immediate prerequisites.
   *   2. Fixed-point propagation: any target whose prerequisite is stale
   *      becomes stale itself. Iterates until no change. Bounded by the
   *      graph diameter, so terminates quickly even on deep DAGs.
   *   Phony targets are considered always-stale (matches Make's semantics).
   */
  function computeStaleness(nodes, edges, nodesById) {
    // Build out-edges (target → prerequisites) for each node.
    var outEdges = {};
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      if (e.kind === 'order-only') continue;  // order-only doesn't propagate staleness
      if (!outEdges[e.from]) outEdges[e.from] = [];
      outEdges[e.from].push(e.to);
    }
    // Pass 1 — direct mtime comparison.
    for (var j = 0; j < nodes.length; j++) {
      var n = nodes[j];
      if (n.isSource) { n.isStale = false; continue; }
      if (n.isPhony) { n.isStale = true; continue; }
      if (n.mtime === undefined) { n.isStale = true; continue; }
      var deps = outEdges[n.id] || [];
      var stale = false;
      for (var d = 0; d < deps.length; d++) {
        var dep = nodesById[deps[d]];
        if (!dep) continue;
        if (dep.mtime !== undefined && dep.mtime > n.mtime) { stale = true; break; }
      }
      n.isStale = stale;
    }
    // Pass 2 — propagate staleness up the graph until fixed point.
    // Each pass marks a node stale if any of its prerequisites is now stale.
    // Bounded by graph diameter; safety cap prevents pathological cycles.
    var changed = true;
    var safety = nodes.length + 1;
    while (changed && safety-- > 0) {
      changed = false;
      for (var k = 0; k < nodes.length; k++) {
        var nk = nodes[k];
        if (nk.isStale) continue;
        if (nk.isSource) continue;
        var deps2 = outEdges[nk.id] || [];
        for (var dd = 0; dd < deps2.length; dd++) {
          var dep2 = nodesById[deps2[dd]];
          if (dep2 && dep2.isStale) { nk.isStale = true; changed = true; break; }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Layout — assign each node a (col, row) coordinate via a simple
  // longest-path layering. Targets that nothing depends on (graph roots)
  // go to row 0. Prerequisites go to row max(prereq_row) - 1, then we
  // shift everything to non-negative.
  // ---------------------------------------------------------------------------

  function layoutDag(nodes, edges) {
    // Build incoming and outgoing adjacency maps.
    var inEdges = {}, outEdges = {};
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      (outEdges[e.from] = outEdges[e.from] || []).push(e.to);
      (inEdges[e.to] = inEdges[e.to] || []).push(e.from);
    }
    // Roots = nodes with no incoming edges (nothing depends on them) — these
    // are the "final targets" in Make-speak.
    var levels = {};
    var unresolved = nodes.slice();
    var changed = true;
    var safety = nodes.length * nodes.length + 10;
    while (changed && safety-- > 0) {
      changed = false;
      for (var k = 0; k < unresolved.length; k++) {
        var n = unresolved[k];
        if (levels[n.id] !== undefined) continue;
        var ins = inEdges[n.id] || [];
        if (ins.length === 0) {
          levels[n.id] = 0;
          changed = true;
          continue;
        }
        // Otherwise, level = max(parent level) + 1, IF all parents resolved.
        var allResolved = true;
        var maxParent = -1;
        for (var p = 0; p < ins.length; p++) {
          if (levels[ins[p]] === undefined) { allResolved = false; break; }
          if (levels[ins[p]] > maxParent) maxParent = levels[ins[p]];
        }
        if (allResolved) {
          levels[n.id] = maxParent + 1;
          changed = true;
        }
      }
    }
    // Any leftover unresolved nodes → cycle. Stack them at the bottom.
    var maxLevel = 0;
    for (var id in levels) if (levels[id] > maxLevel) maxLevel = levels[id];
    for (var u = 0; u < nodes.length; u++) {
      if (levels[nodes[u].id] === undefined) levels[nodes[u].id] = maxLevel + 1;
    }
    // Bucket nodes by level.
    var byLevel = [];
    for (var v = 0; v < nodes.length; v++) {
      var nv = nodes[v];
      var lvl = levels[nv.id];
      (byLevel[lvl] = byLevel[lvl] || []).push(nv);
    }
    // Sort each level alphabetically for stable layout across renders.
    for (var lv = 0; lv < byLevel.length; lv++) {
      if (byLevel[lv]) byLevel[lv].sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    }
    // Assign (col, row) coords.
    var positions = {};
    for (var rl = 0; rl < byLevel.length; rl++) {
      var row = byLevel[rl];
      if (!row) continue;
      for (var ci = 0; ci < row.length; ci++) {
        positions[row[ci].id] = { col: ci, row: rl, levelWidth: row.length };
      }
    }
    return { positions: positions, byLevel: byLevel, maxLevel: byLevel.length - 1 };
  }

  // ---------------------------------------------------------------------------
  // Renderer — draws the graph as inline SVG inside `container`.
  // ---------------------------------------------------------------------------

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function MakeGraph(container, options) {
    this.container = container;
    this.options = options || {};
    this._lastData = null;
  }

  MakeGraph.prototype.render = function (data) {
    this._lastData = data;
    var c = this.container;
    if (!c) return;
    if (!data || !data.nodes || data.nodes.length === 0) {
      c.innerHTML =
        '<div class="tvm-make-dag-empty" role="status">' +
        (data && data.makefilePresent === false
          ? 'No Makefile found yet — once you write one in <code>' +
            (this.options.dirLabel || 'this directory') +
            '</code> the graph will appear here.'
          : 'No targets in the dependency graph yet.') +
        '</div>';
      return;
    }

    var layout = layoutDag(data.nodes, data.edges);
    var nodesById = {};
    for (var i = 0; i < data.nodes.length; i++) nodesById[data.nodes[i].id] = data.nodes[i];

    // Geometry constants — tuned to fit ≈12 nodes comfortably.
    var nodeW = 140, nodeH = 40;
    var hGap = 36, vGap = 64;
    var maxLevelWidth = 1;
    for (var lv = 0; lv <= layout.maxLevel; lv++) {
      if (layout.byLevel[lv] && layout.byLevel[lv].length > maxLevelWidth) {
        maxLevelWidth = layout.byLevel[lv].length;
      }
    }
    var width = Math.max(360, maxLevelWidth * (nodeW + hGap) + hGap);
    var height = Math.max(160, (layout.maxLevel + 1) * (nodeH + vGap) + vGap);

    // Build SVG.
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'tvm-make-dag-svg');
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label',
      'Dependency graph: ' + data.nodes.length + ' nodes, ' + data.edges.length + ' edges');

    // Defs — arrow marker.
    var defs = document.createElementNS(SVG_NS, 'defs');
    defs.innerHTML =
      '<marker id="tvm-mg-arrow" viewBox="0 0 10 10" refX="8" refY="5" ' +
      '  markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
      '  <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />' +
      '</marker>';
    svg.appendChild(defs);

    function nodeCenter(id) {
      var pos = layout.positions[id];
      if (!pos) return null;
      var rowWidth = (layout.byLevel[pos.row] || []).length;
      // Center each row horizontally.
      var rowOffset = (width - rowWidth * (nodeW + hGap) + hGap) / 2;
      var x = rowOffset + pos.col * (nodeW + hGap) + nodeW / 2;
      var y = vGap / 2 + pos.row * (nodeH + vGap) + nodeH / 2;
      return { x: x, y: y };
    }

    // Edges first so nodes sit on top.
    for (var ei = 0; ei < data.edges.length; ei++) {
      var edge = data.edges[ei];
      var fromCenter = nodeCenter(edge.from);
      var toCenter = nodeCenter(edge.to);
      if (!fromCenter || !toCenter) continue;
      var fromNode = nodesById[edge.from];
      var stale = fromNode && fromNode.isStale;
      var orderOnly = edge.kind === 'order-only';
      // Start at bottom of from, end at top of to.
      var fx = fromCenter.x, fy = fromCenter.y + nodeH / 2;
      var tx = toCenter.x, ty = toCenter.y - nodeH / 2;
      var line = document.createElementNS(SVG_NS, 'path');
      // Slight curve when columns differ so stacked edges don't overlap.
      var midY = (fy + ty) / 2;
      var d = 'M' + fx + ',' + fy +
              ' C' + fx + ',' + midY + ' ' + tx + ',' + midY + ' ' + tx + ',' + ty;
      line.setAttribute('d', d);
      line.setAttribute('class',
        'tvm-make-dag-edge' +
        (orderOnly ? ' tvm-make-dag-edge-order-only' : '') +
        (stale ? ' tvm-make-dag-edge-stale' : ''));
      line.setAttribute('marker-end', 'url(#tvm-mg-arrow)');
      svg.appendChild(line);
    }

    // Nodes.
    for (var ni = 0; ni < data.nodes.length; ni++) {
      var node = data.nodes[ni];
      var center = nodeCenter(node.id);
      if (!center) continue;
      var g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class',
        'tvm-make-dag-node' +
        (node.isSource ? ' tvm-make-dag-node-source' : '') +
        (node.isPhony ? ' tvm-make-dag-node-phony' : '') +
        (node.isStale && !node.isSource ? ' tvm-make-dag-node-stale' : '') +
        (!node.isStale && !node.isSource ? ' tvm-make-dag-node-fresh' : ''));
      g.setAttribute('transform',
        'translate(' + (center.x - nodeW / 2) + ',' + (center.y - nodeH / 2) + ')');
      g.setAttribute('role', 'group');
      // Build readable accessible label.
      var label = node.id;
      if (node.isPhony) label += ' (phony target)';
      else if (node.isSource) label += ' (source file)';
      else label += node.isStale ? ' (out of date)' : ' (up to date)';
      g.setAttribute('aria-label', label);
      g.setAttribute('tabindex', '0');
      if (node.line) g.setAttribute('data-line', String(node.line));
      g.setAttribute('data-target', node.id);

      // Background rectangle.
      var rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('class', 'tvm-make-dag-node-rect');
      rect.setAttribute('width', nodeW);
      rect.setAttribute('height', nodeH);
      rect.setAttribute('rx', 6);
      rect.setAttribute('ry', 6);
      g.appendChild(rect);

      // State stripe on left edge. Inset by the corner radius so the stripe
      // sits entirely within the rect's straight (non-curved) portion;
      // otherwise the rect's rounded corners curve away at top/bottom and
      // the stripe pokes out past the edge — which read as the stripe being
      // "cut off" at the corners.
      if (!node.isSource) {
        var stripeInset = 6;            // matches rect's rx/ry
        var stripe = document.createElementNS(SVG_NS, 'rect');
        stripe.setAttribute('class', 'tvm-make-dag-node-stripe');
        stripe.setAttribute('x', 1);     // 1px inset on the left for visual breathing room
        stripe.setAttribute('y', stripeInset);
        stripe.setAttribute('width', 4);
        stripe.setAttribute('height', nodeH - 2 * stripeInset);
        stripe.setAttribute('rx', 1);
        stripe.setAttribute('ry', 1);
        g.appendChild(stripe);
      }

      // Status glyph on right (✓ for fresh, • for stale, dashed for phony).
      var glyphX = nodeW - 14;
      var glyphY = nodeH / 2 + 4;
      var glyph = document.createElementNS(SVG_NS, 'text');
      glyph.setAttribute('class', 'tvm-make-dag-node-glyph');
      glyph.setAttribute('x', glyphX);
      glyph.setAttribute('y', glyphY);
      glyph.setAttribute('text-anchor', 'middle');
      var glyphText = '';
      if (node.isPhony) glyphText = '⌖';        // dashed-circle stand-in
      else if (node.isSource) glyphText = '';
      else if (node.isStale) glyphText = '●';   // pulse origin
      else glyphText = '✓';
      glyph.textContent = glyphText;
      g.appendChild(glyph);

      // Label text (centered).
      var text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('class', 'tvm-make-dag-node-label');
      text.setAttribute('x', nodeW / 2 - 4);
      text.setAttribute('y', nodeH / 2 + 4);
      text.setAttribute('text-anchor', 'middle');
      text.textContent = node.id.length > 18 ? node.id.substring(0, 16) + '…' : node.id;
      g.appendChild(text);

      // Tooltip via <title>.
      var titleEl = document.createElementNS(SVG_NS, 'title');
      var title = node.id;
      if (node.recipe) title += '\n\nRecipe:\n' + node.recipe;
      if (node.mtime) {
        var d = new Date(node.mtime * 1000);
        title += '\n\nLast modified: ' + d.toLocaleString();
      }
      titleEl.textContent = title;
      g.appendChild(titleEl);

      // Click → emit event so the host can jump to the rule.
      (function (target, line) {
        g.addEventListener('click', function () {
          var ev = new CustomEvent('make-graph:node-click', {
            bubbles: true,
            detail: { target: target, line: line },
          });
          c.dispatchEvent(ev);
        });
        // Keyboard activation: Enter/Space on focused node.
        g.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            var ev2 = new CustomEvent('make-graph:node-click', {
              bubbles: true,
              detail: { target: target, line: line },
            });
            c.dispatchEvent(ev2);
          }
        });
      })(node.id, node.line);

      svg.appendChild(g);
    }

    // Replace.
    while (c.firstChild) c.removeChild(c.firstChild);
    var wrapper = document.createElement('div');
    wrapper.className = 'tvm-make-dag-canvas';
    wrapper.appendChild(svg);
    c.appendChild(wrapper);

    // Legend.
    var legend = document.createElement('div');
    legend.className = 'tvm-make-dag-legend';
    legend.setAttribute('aria-label', 'Graph legend');
    legend.innerHTML =
      '<span class="tvm-make-dag-legend-item"><span class="tvm-make-dag-legend-swatch tvm-make-dag-legend-fresh" aria-hidden="true"></span>up to date</span>' +
      '<span class="tvm-make-dag-legend-item"><span class="tvm-make-dag-legend-swatch tvm-make-dag-legend-stale" aria-hidden="true"></span>stale (would rebuild)</span>' +
      '<span class="tvm-make-dag-legend-item"><span class="tvm-make-dag-legend-swatch tvm-make-dag-legend-phony" aria-hidden="true"></span>phony target</span>' +
      '<span class="tvm-make-dag-legend-item"><span class="tvm-make-dag-legend-swatch tvm-make-dag-legend-source" aria-hidden="true"></span>source file</span>';
    c.appendChild(legend);
  };

  /**
   * Convenience — set up listeners that delegate node clicks to a handler
   * (typically: open the Makefile in the editor and scroll to the rule).
   */
  MakeGraph.prototype.onNodeClick = function (handler) {
    if (typeof handler !== 'function') return;
    this.container.addEventListener('make-graph:node-click', function (e) {
      handler(e.detail);
    });
  };

  // Static API surface for the host.
  MakeGraph.parseMakeDb = parseMakeDb;
  MakeGraph._test = {
    parsePhony: parsePhony,
    parseMtimes: parseMtimes,
    parseFilesSection: parseFilesSection,
    parseTimestamp: parseTimestamp,
    layoutDag: layoutDag,
    computeStaleness: computeStaleness,
    prefersReducedMotion: prefersReducedMotion,
  };

  window.MakeGraph = MakeGraph;
})();
