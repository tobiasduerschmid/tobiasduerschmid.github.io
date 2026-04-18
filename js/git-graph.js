/**
 * GitGraph — SVG-based Git commit graph visualization
 *
 * Renders a visual DAG (Directed Acyclic Graph) of Git commits, branches,
 * and HEAD, similar to learngitbranching.js.org. Designed to be embedded
 * in the TutorialCode engine as an alternative to the Monaco editor panel.
 *
 * Usage:
 *   var graph = new GitGraph(containerElement);
 *   graph.render(parsedData);
 *
 * parsedData format (from GitGraph.parseGitState):
 *   { commits: [...], branches: [...], head: { ref, hash, detached } }
 */
(function () {
  'use strict';

  // Branch color palette — UCLA colors first, then general palette for variety
  var BRANCH_COLORS = [
    '#2774AE', // UCLA Blue
    '#FFB81C', // UCLA Darkest Gold
    '#e74c3c', // red
    '#2ecc71', // green
    '#9b59b6', // purple
    '#1abc9c', // teal
    '#e67e22', // orange
    '#e84393', // pink
  ];

  // Layout constants
  var NODE_RADIUS = 22;
  var ROW_HEIGHT = 80;
  var COL_WIDTH = 80;
  var PADDING_TOP = 50;
  var PADDING_LEFT = 185;  // extra space for branch labels + HEAD pointer on the left
  var PADDING_BOTTOM = 40;
  var LABEL_OFFSET_X = 34;
  var LABEL_HEIGHT = 24;
  var LABEL_GAP = 4;

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------
  function GitGraph(container) {
    this.container = container;
    this.svg = null;
    this._data = null;
    this._animating = false;
  }

  // ---------------------------------------------------------------------------
  // Parse git log + branch output into structured data
  // ---------------------------------------------------------------------------

  /**
   * Parse the combined output of:
   *   git log --all --format='%H|%P|%s|%D' --topo-order
   *   git branch -a
   *   git symbolic-ref HEAD (or 'detached')
   *
   * Returns { commits: [...], branches: [...], head: { ref, hash, detached } }
   */
  GitGraph.parseGitState = function (logOutput, branchOutput, headRef) {
    var commits = [];
    var branchMap = {};   // branch name → commit hash
    var commitMap = {};   // hash → commit object

    // Parse log lines
    var logLines = (logOutput || '').trim().split('\n').filter(Boolean);
    for (var i = 0; i < logLines.length; i++) {
      var parts = logLines[i].split('|');
      if (parts.length < 3) continue;
      var hash = parts[0].trim();
      var parentStr = parts[1].trim();
      var message = parts[2].trim();
      var decorations = parts.length > 3 ? parts.slice(3).join('|').trim() : '';

      var parents = parentStr ? parentStr.split(/\s+/) : [];

      var commit = {
        hash: hash,
        shortHash: hash.substring(0, 4) + '\u2026',
        parents: parents,
        message: message,
        decorations: decorations,
        children: [],
        col: 0,
        row: 0,
        branchColor: null,
      };
      commits.push(commit);
      commitMap[hash] = commit;
    }

    // Build children references
    for (var c = 0; c < commits.length; c++) {
      var cm = commits[c];
      for (var p = 0; p < cm.parents.length; p++) {
        var parent = commitMap[cm.parents[p]];
        if (parent) parent.children.push(cm.hash);
      }
    }

    // Parse branch info from decorations and branch output
    var branchLines = (branchOutput || '').trim().split('\n').filter(Boolean);
    for (var b = 0; b < branchLines.length; b++) {
      var line = branchLines[b].trim();
      if (line.startsWith('* ')) line = line.substring(2).trim();
      // Skip detached HEAD indicator
      if (line.startsWith('(HEAD detached')) continue;
      // Skip remote tracking branches for cleaner display
      if (line.startsWith('remotes/')) continue;
      // Find the commit this branch points to
      for (var ci = 0; ci < commits.length; ci++) {
        var decs = commits[ci].decorations;
        if (decs && decs.indexOf(line) !== -1) {
          branchMap[line] = commits[ci].hash;
          break;
        }
      }
    }

    // Also extract branches from decorations directly (more reliable)
    for (var d = 0; d < commits.length; d++) {
      var dec = commits[d].decorations;
      if (!dec) continue;
      // Parse decoration string: "HEAD -> main, origin/main, feature"
      var decParts = dec.split(',');
      for (var dp = 0; dp < decParts.length; dp++) {
        var decPart = decParts[dp].trim();
        // Remove "HEAD -> " prefix
        decPart = decPart.replace(/^HEAD\s*->\s*/, '');
        // Skip origin/ remotes and tag: prefixes
        if (decPart.startsWith('origin/') || decPart.startsWith('tag:')) continue;
        if (decPart && decPart !== 'HEAD') {
          branchMap[decPart] = commits[d].hash;
        }
      }
    }

    // Parse HEAD state
    var head = { ref: null, hash: null, detached: false };
    var headRefStr = (headRef || '').trim();
    if (headRefStr === 'detached' || headRefStr === '') {
      head.detached = true;
      // Find the commit with HEAD decoration
      for (var h = 0; h < commits.length; h++) {
        if (commits[h].decorations && commits[h].decorations.indexOf('HEAD') !== -1) {
          head.hash = commits[h].hash;
          break;
        }
      }
    } else {
      // headRef is like "refs/heads/main"
      head.ref = headRefStr.replace('refs/heads/', '');
      head.hash = branchMap[head.ref] || (commits.length > 0 ? commits[0].hash : null);
    }

    // Build branches array
    var branches = [];
    for (var name in branchMap) {
      if (branchMap.hasOwnProperty(name)) {
        branches.push({ name: name, hash: branchMap[name] });
      }
    }

    return { commits: commits, branches: branches, head: head, commitMap: commitMap };
  };

  // ---------------------------------------------------------------------------
  // Layout algorithm — assign columns and rows to commits
  // ---------------------------------------------------------------------------
  GitGraph.prototype._layout = function (data) {
    var commits = data.commits;
    var branches = data.branches;
    var commitMap = data.commitMap;

    if (commits.length === 0) return;

    // Assign colors to branches by consistent hashing
    var branchColors = {};
    for (var bi = 0; bi < branches.length; bi++) {
      var bname = branches[bi].name;
      var colorIdx = this._hashString(bname) % BRANCH_COLORS.length;
      branchColors[bname] = BRANCH_COLORS[colorIdx];
    }
    // Ensure 'main' and 'master' get UCLA Blue
    if (branchColors['main']) branchColors['main'] = BRANCH_COLORS[0];
    if (branchColors['master']) branchColors['master'] = BRANCH_COLORS[0];

    // -------------------------------------------------------------------------
    // Lane-based column assignment (prevents crossing lines)
    //
    // lanes[i] = hash of the commit we expect to see next in lane i
    //            (null = lane is free / available)
    //
    // Algorithm (processes commits in topo order, newest first):
    //   1. If a commit is already scheduled in a lane → use that lane.
    //   2. Otherwise pick the first free lane (or open a new one).
    //   3. After placing the commit, clear its lane entry.
    //   4. Schedule its first parent into the same lane (straight continuation).
    //      If the first parent is already scheduled elsewhere, the lane is freed.
    //   5. Each additional parent (merge) is scheduled into a new free lane,
    //      unless it is already scheduled.
    // -------------------------------------------------------------------------
    var lanes = [];

    for (var r = 0; r < commits.length; r++) {
      var cm = commits[r];

      // 1. Find whether this commit is already expected in some lane.
      var myLane = -1;
      for (var l = 0; l < lanes.length; l++) {
        if (lanes[l] === cm.hash) { myLane = l; break; }
      }

      // 2. No lane waiting → pick first free slot (or grow the array).
      if (myLane === -1) {
        for (var l2 = 0; l2 < lanes.length; l2++) {
          if (lanes[l2] === null) { myLane = l2; break; }
        }
        if (myLane === -1) { myLane = lanes.length; lanes.push(null); }
      }

      cm.col = myLane;
      cm.row = r;

      // 3. Remove ALL occurrences of this commit from the lanes array
      //    (handles the case where multiple children pointed to it).
      for (var l3 = 0; l3 < lanes.length; l3++) {
        if (lanes[l3] === cm.hash) lanes[l3] = null;
      }

      // 4. Schedule the first parent into myLane (straight continuation).
      if (cm.parents.length >= 1) {
        var fp = cm.parents[0];
        var fpLane = -1;
        for (var l4 = 0; l4 < lanes.length; l4++) {
          if (lanes[l4] === fp) { fpLane = l4; break; }
        }
        if (fpLane === -1) {
          // Parent not yet scheduled — claim myLane for it.
          lanes[myLane] = fp;
        }
        // else: parent already scheduled in another lane; myLane stays free.
      }

      // 5. Schedule additional parents (merge commits) into free lanes.
      for (var pi = 1; pi < cm.parents.length; pi++) {
        var mp = cm.parents[pi];
        var mpAlready = false;
        for (var l5 = 0; l5 < lanes.length; l5++) {
          if (lanes[l5] === mp) { mpAlready = true; break; }
        }
        if (!mpAlready) {
          var freeLane = -1;
          for (var l6 = 0; l6 < lanes.length; l6++) {
            if (lanes[l6] === null) { freeLane = l6; break; }
          }
          if (freeLane === -1) { freeLane = lanes.length; lanes.push(null); }
          lanes[freeLane] = mp;
        }
      }
    }

    // -------------------------------------------------------------------------
    // Assign branch colors to each commit via first-parent chain propagation
    // -------------------------------------------------------------------------
    var commitBranch = {};
    // Seed: branch tips
    for (var bt = 0; bt < branches.length; bt++) {
      commitBranch[branches[bt].hash] = branches[bt].name;
    }
    // Propagate: a commit inherits the branch of its first child that knows its branch
    for (var ci = 0; ci < commits.length; ci++) {
      var cm2 = commits[ci];
      if (!commitBranch[cm2.hash]) {
        for (var ch = 0; ch < cm2.children.length; ch++) {
          if (commitBranch[cm2.children[ch]]) {
            var childCm = commitMap[cm2.children[ch]];
            if (childCm && childCm.parents[0] === cm2.hash) {
              commitBranch[cm2.hash] = commitBranch[cm2.children[ch]];
              break;
            }
          }
        }
      }
      if (!commitBranch[cm2.hash]) {
        commitBranch[cm2.hash] = branches.length > 0 ? branches[0].name : 'main';
      }
      cm2.branchColor = branchColors[commitBranch[cm2.hash]] || BRANCH_COLORS[0];
      cm2.branchName  = commitBranch[cm2.hash];
    }

    // Total column count
    var colCount = 0;
    for (var fc = 0; fc < commits.length; fc++) {
      if (commits[fc].col >= colCount) colCount = commits[fc].col + 1;
    }

    this._branchColors = branchColors;
    this._commitBranch = commitBranch;
    this._colCount = colCount;

    // Compute extra right-side space needed for labels that flip to the right
    // (any branch whose tip commit sits on col > 0).
    // We measure only the ADDITIONAL pixels beyond the last column's x — not the
    // full label width — so we don't over-inflate the message area.
    var rightLabelSpace = 0;
    var lastColX = PADDING_LEFT + colCount * COL_WIDTH;
    var PTR_D    = LABEL_HEIGHT / 2;   // 12
    var HEAD_W   = (4 * 7.5 + 16) + PTR_D; // "HEAD" label full width
    for (var rb = 0; rb < branches.length; rb++) {
      var rbName   = branches[rb].name;
      var rbCommit = commitMap[branches[rb].hash];
      if (!rbCommit || rbCommit.col === 0) continue;
      var brTipX  = PADDING_LEFT + rbCommit.col * COL_WIDTH + NODE_RADIUS + 10; // TIP_TO_NODE=10
      var brW     = rbName.length * 7.5 + 16 + PTR_D;
      var rEdge   = brTipX + brW;
      // Add HEAD label width only when this branch actually carries HEAD
      if (!data.head.detached && data.head.ref === rbName) {
        rEdge += 4 + HEAD_W;  // HEAD_GAP=4
      }
      rightLabelSpace = Math.max(rightLabelSpace, rEdge - lastColX);
    }
    this._rightLabelSpace = Math.max(0, rightLabelSpace);
  };

  /**
   * Returns an SVG path string for a left-flush rectangle with a right-pointing
   * triangular tip ("pointer" / "tag" shape).
   * x,y = top-left of bounding box; w,h = total width and height.
   * The triangle depth equals h/2 so the tip is a sharp point.
   */
  /**
   * Pointer/chevron path.
   * direction 'right' (default): tip on the right  ▶
   * direction 'left':            tip on the left   ◀
   */
  GitGraph.prototype._pointerPath = function (x, y, w, h, direction) {
    var d = h / 2;  // depth of the triangular tip
    if (direction === 'left') {
      // Left-pointing: tip at (x, y+d), rectangle spans x+d → x+w
      return [
        'M', x,         y + d,
        'L', x + d,     y,
        'L', x + w,     y,
        'L', x + w,     y + h,
        'L', x + d,     y + h,
        'Z'
      ].join(' ');
    }
    // Right-pointing (default): tip at (x+w, y+d)
    return [
      'M', x,         y,
      'L', x + w - d, y,
      'L', x + w,     y + d,
      'L', x + w - d, y + h,
      'L', x,         y + h,
      'Z'
    ].join(' ');
  };

  GitGraph.prototype._hashString = function (str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  };

  // ---------------------------------------------------------------------------
  // SVG Rendering
  // ---------------------------------------------------------------------------

  /**
   * Produce the SVG markup for a data set without touching any container.
   * Returns '' for empty data so callers can decide what to show.
   *
   * Useful for reuse outside the live-git-state flow — e.g. a static-spec
   * renderer that builds the data structure from a text DSL and wants to
   * drop the resulting SVG anywhere.
   */
  GitGraph.prototype.toSVG = function (data) {
    if (!data || !data.commits || data.commits.length === 0) return '';

    this._layout(data);

    var commits = data.commits;
    var branches = data.branches;
    var head = data.head;

    var width = PADDING_LEFT + (this._colCount - 1) * COL_WIDTH + NODE_RADIUS + 24 + this._maxMessagePx(commits) + 24;
    var height = PADDING_TOP + commits.length * ROW_HEIGHT + PADDING_BOTTOM;

    // viewBox is essential — without it, `max-width: 100%; height: auto`
    // (from uml-diagram.css) can't preserve aspect ratio when the container
    // is narrower than the intrinsic width, and the bottom of the graph
    // gets clipped.
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" ' +
      'viewBox="0 0 ' + width + ' ' + height + '" ' +
      'class="git-graph-svg" style="font-family:\'Fira Code\',\'Cascadia Code\',Menlo,monospace;">';

    // Draw edges first (behind nodes)
    svg += this._renderEdges(commits, data.commitMap);

    // Draw commit nodes
    svg += this._renderNodes(commits, head);

    // Draw branch labels
    svg += this._renderBranchLabels(branches, data.commitMap, head);

    svg += '</svg>';
    return svg;
  };

  GitGraph.prototype.render = function (data) {
    this._data = data;
    if (!data || !data.commits || data.commits.length === 0) {
      this._svgRoot = null;
      this._nodeEls = {};
      this._edgeEls = {};
      this._labelEls = {};
      if (this.container && !this.container.querySelector('.git-graph-svg')) {
        this.container.innerHTML =
          '<div class="git-graph-empty">' +
          '<div style="text-align:center">' +
          '<div style="font-size:48px;margin-bottom:12px;">&#x1f333;</div>' +
          '<div>No commits yet.<br>Run <code>git commit</code> to see the graph.</div>' +
          '</div></div>';
      }
      return;
    }

    this._layout(data);
    var dims = this._computeDimensions(data);

    if (!this._svgRoot || !this.container || !this.container.contains(this._svgRoot)) {
      this._buildInitialSvg(dims);
    } else {
      this._animateDimensions(dims);
    }

    this._diffRender(data);
  };

  // Smoothly tween width/height/viewBox so the SVG canvas grows or shrinks
  // in step with the node and edge transitions (which use the same 520ms
  // ease curve in git-graph.css). Without this the canvas snaps abruptly
  // whenever a longer commit message or new column changes the dimensions.
  GitGraph.prototype._animateDimensions = function (newDims) {
    var svg = this._svgRoot;
    if (!svg) return;
    var startW = parseFloat(svg.getAttribute('width'))  || newDims.width;
    var startH = parseFloat(svg.getAttribute('height')) || newDims.height;
    var endW = newDims.width;
    var endH = newDims.height;

    if (Math.abs(startW - endW) < 0.5 && Math.abs(startH - endH) < 0.5) {
      svg.setAttribute('width', endW);
      svg.setAttribute('height', endH);
      svg.setAttribute('viewBox', '0 0 ' + endW + ' ' + endH);
      return;
    }

    if (this._dimAnim) cancelAnimationFrame(this._dimAnim);

    var DURATION = 520;
    var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    function ease(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; }

    var self = this;
    function frame(now) {
      var t = Math.min(1, (now - t0) / DURATION);
      var k = ease(t);
      var w = startW + (endW - startW) * k;
      var h = startH + (endH - startH) * k;
      svg.setAttribute('width',  w);
      svg.setAttribute('height', h);
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      if (t < 1) {
        self._dimAnim = requestAnimationFrame(frame);
      } else {
        self._dimAnim = null;
      }
    }
    self._dimAnim = requestAnimationFrame(frame);

    // Fallback: when the tab is hidden (e.g. headless preview, background tab)
    // requestAnimationFrame is throttled and may not fire, leaving the SVG at
    // its initial dimensions. Snap to the final size after the duration so the
    // graph is correct even without animation.
    setTimeout(function () {
      if (self._dimAnim) cancelAnimationFrame(self._dimAnim);
      self._dimAnim = null;
      svg.setAttribute('width',  endW);
      svg.setAttribute('height', endH);
      svg.setAttribute('viewBox', '0 0 ' + endW + ' ' + endH);
    }, DURATION + 30);
  };

  // ---------------------------------------------------------------------------
  // Diff-based rendering — keeps DOM elements stable across renders so CSS
  // can animate transitions. See css/tutorial.css for the matching keyframes.
  // ---------------------------------------------------------------------------

  var SVG_NS = 'http://www.w3.org/2000/svg';

  GitGraph.prototype._svgEl = function (name, attrs) {
    var el = document.createElementNS(SVG_NS, name);
    if (attrs) {
      for (var k in attrs) {
        if (attrs.hasOwnProperty(k)) el.setAttribute(k, attrs[k]);
      }
    }
    return el;
  };

  GitGraph.prototype._computeDimensions = function (data) {
    return {
      width: PADDING_LEFT + (this._colCount - 1) * COL_WIDTH + NODE_RADIUS + 24 + this._maxMessagePx(data.commits) + 24,
      height: PADDING_TOP + data.commits.length * ROW_HEIGHT + PADDING_BOTTOM,
    };
  };

  GitGraph.prototype._maxMessagePx = function (commits) {
    var max = 0;
    for (var i = 0; i < commits.length; i++) {
      var len = Math.min(commits[i].message.length, 50);
      if (len > max) max = len;
    }
    return Math.ceil(max * 7);
  };

  GitGraph.prototype._buildInitialSvg = function (dims) {
    if (!this.container) return;
    this.container.innerHTML = '';
    this._svgRoot = this._svgEl('svg', {
      xmlns: SVG_NS,
      width: dims.width,
      height: dims.height,
      viewBox: '0 0 ' + dims.width + ' ' + dims.height,
      'class': 'git-graph-svg',
      style: "font-family:'Fira Code','Cascadia Code',Menlo,monospace;",
    });
    this._edgesLayer = this._svgEl('g', { 'class': 'git-graph-edges-layer' });
    this._nodesLayer = this._svgEl('g', { 'class': 'git-graph-nodes-layer' });
    this._labelsLayer = this._svgEl('g', { 'class': 'git-graph-labels-layer' });
    this._svgRoot.appendChild(this._edgesLayer);
    this._svgRoot.appendChild(this._nodesLayer);
    this._svgRoot.appendChild(this._labelsLayer);
    this.container.appendChild(this._svgRoot);

    this._nodeEls = {};
    this._edgeEls = {};
    this._labelEls = {};
  };

  GitGraph.prototype._diffRender = function (data) {
    var rebaseMap = this._detectRebases(data.commits);
    if (rebaseMap) this._applyRebaseMapping(rebaseMap);
    this._diffEdges(data.commits, data.commitMap);
    this._diffNodes(data.commits, data.head);
    this._diffLabels(data.branches, data.commitMap, data.head);
  };

  // Detect rebase / cherry-pick where commits get NEW hashes but carry the
  // SAME commit message. Returns oldHash->newHash so the existing DOM nodes
  // can be re-keyed and slid to their new positions instead of fading out
  // and a brand-new node fading in.
  GitGraph.prototype._detectRebases = function (commits) {
    var newHashes = {};
    for (var i = 0; i < commits.length; i++) newHashes[commits[i].hash] = true;

    var removedByMessage = {};
    var hasRemoved = false;
    for (var h in this._nodeEls) {
      if (!this._nodeEls.hasOwnProperty(h)) continue;
      if (newHashes[h]) continue;
      if (this._nodeEls[h]._removalTimer) continue;
      var msg = this._nodeEls[h].message;
      if (!msg) continue;
      if (!removedByMessage[msg]) removedByMessage[msg] = [];
      removedByMessage[msg].push(h);
      hasRemoved = true;
    }
    if (!hasRemoved) return null;

    var rebaseMap = null;
    for (var ci = 0; ci < commits.length; ci++) {
      var cm = commits[ci];
      if (this._nodeEls[cm.hash]) continue;
      var bucket = removedByMessage[cm.message];
      if (bucket && bucket.length > 0) {
        if (!rebaseMap) rebaseMap = {};
        rebaseMap[bucket.shift()] = cm.hash;
      }
    }
    return rebaseMap;
  };

  GitGraph.prototype._applyRebaseMapping = function (rebaseMap) {
    for (var oldHash in rebaseMap) {
      if (!rebaseMap.hasOwnProperty(oldHash)) continue;
      var newHash = rebaseMap[oldHash];
      var entry = this._nodeEls[oldHash];
      if (!entry) continue;
      delete this._nodeEls[oldHash];
      this._nodeEls[newHash] = entry;
      entry.g.setAttribute('data-hash', newHash);
    }

    var rekeyedEdges = {};
    for (var k in this._edgeEls) {
      if (!this._edgeEls.hasOwnProperty(k)) continue;
      var edgeEntry = this._edgeEls[k];
      var parts = k.split('__');
      var newChild = rebaseMap[parts[0]] || parts[0];
      var newParent = rebaseMap[parts[1]] || parts[1];
      var newKey = newChild + '__' + newParent;
      if (newKey !== k) {
        edgeEntry.el.setAttribute('data-edge-key', newKey);
      }
      rekeyedEdges[newKey] = edgeEntry;
    }
    this._edgeEls = rekeyedEdges;
  };

  // ---- Edges ----------------------------------------------------------------

  GitGraph.prototype._diffEdges = function (commits, commitMap) {
    var required = [];
    for (var i = 0; i < commits.length; i++) {
      var cm = commits[i];
      for (var p = 0; p < cm.parents.length; p++) {
        var parent = commitMap[cm.parents[p]];
        if (!parent) continue;
        required.push({
          cm: cm, parent: parent,
          key: cm.hash + '__' + cm.parents[p],
          x1: this._cx(cm.col), y1: this._cy(cm.row),
          x2: this._cx(parent.col), y2: this._cy(parent.row),
          color: cm.branchColor,
          satisfied: false,
        });
      }
    }

    var newKeys = {};

    // Pass 1: direct key match (steady state).
    for (var r1 = 0; r1 < required.length; r1++) {
      var req = required[r1];
      var entry = this._edgeEls[req.key];
      if (!entry || entry._removalTimer) continue;
      req.satisfied = true;
      newKeys[req.key] = true;
      this._updateEdge(entry, req.x1, req.y1, req.x2, req.y2, req.color);
    }

    // Pass 2: rebase reparenting — an unsatisfied requirement shares its
    // child with a now-orphaned edge. Reuse the DOM element and morph its
    // `d` attribute so the edge re-attaches to the new parent via the
    // existing `d` transition, instead of retract + fresh-draw.
    for (var r2 = 0; r2 < required.length; r2++) {
      var req2 = required[r2];
      if (req2.satisfied) continue;
      for (var oldKey in this._edgeEls) {
        if (!this._edgeEls.hasOwnProperty(oldKey)) continue;
        if (newKeys[oldKey]) continue;
        var oldEntry = this._edgeEls[oldKey];
        if (oldEntry._removalTimer) continue;
        if (oldKey.split('__')[0] !== req2.cm.hash) continue;
        delete this._edgeEls[oldKey];
        this._edgeEls[req2.key] = oldEntry;
        oldEntry.el.setAttribute('data-edge-key', req2.key);
        req2.satisfied = true;
        newKeys[req2.key] = true;
        this._updateEdge(oldEntry, req2.x1, req2.y1, req2.x2, req2.y2, req2.color);
        break;
      }
    }

    // Pass 3: create brand-new edges for the remaining requirements.
    for (var r3 = 0; r3 < required.length; r3++) {
      var req3 = required[r3];
      if (req3.satisfied) continue;
      var fresh = this._createEdge(req3.key, req3.x1, req3.y1, req3.x2, req3.y2, req3.color);
      this._edgesLayer.appendChild(fresh.el);
      this._animateEdgeIn(fresh);
      this._edgeEls[req3.key] = fresh;
      newKeys[req3.key] = true;
    }

    // Cleanup — remove any edge not claimed by a requirement.
    for (var k in this._edgeEls) {
      if (this._edgeEls.hasOwnProperty(k) && !newKeys[k] && !this._edgeEls[k]._removalTimer) {
        this._removeEdge(this._edgeEls[k], k);
      }
    }
  };

  GitGraph.prototype._createEdge = function (key, x1, y1, x2, y2, color) {
    // Always use <path> (even for same-column straight lines). That way an
    // edge that switches between straight and curved during a layout shift
    // can smoothly morph via CSS `d` transition instead of being destroyed
    // and recreated (which caused the visible flash the user reported).
    var el = this._svgEl('path', {
      d: this._edgePathD(x1, y1, x2, y2),
      fill: 'none', stroke: color, 'stroke-width': 3, 'stroke-opacity': 0.7,
      'class': 'git-graph-edge',
      'data-edge-key': key,
    });
    return { el: el, x1: x1, y1: y1, x2: x2, y2: y2, color: color };
  };

  // Stroke-dashoffset trick to "draw in" a new edge.
  // Why: SVG `d`/`x2/y2` don't transition via CSS, so a new edge would
  // otherwise pop. Setting dasharray=length and animating dashoffset to 0
  // makes the line appear to grow from its starting point.
  GitGraph.prototype._animateEdgeIn = function (entry) {
    var el = entry.el;
    var len;
    try {
      if (el.getTotalLength) {
        len = el.getTotalLength();
      } else {
        len = Math.hypot(entry.x2 - entry.x1, entry.y2 - entry.y1);
      }
    } catch (e) {
      len = Math.hypot(entry.x2 - entry.x1, entry.y2 - entry.y1);
    }
    if (!len || !isFinite(len)) return;
    el.style.strokeDasharray = len + 'px';
    el.style.strokeDashoffset = len + 'px';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.style.strokeDashoffset = '0px';
      });
    });
    setTimeout(function () {
      el.style.strokeDasharray = '';
      el.style.strokeDashoffset = '';
    }, 900);
  };

  // Every edge uses a cubic Bezier (C command). For same-column "straight"
  // segments the two control points collapse onto the straight line so the
  // rendered path is visually straight — but the command structure stays
  // identical to curved edges. This lets CSS interpolate the `d` attribute
  // smoothly when a rebase morphs an edge between straight↔curved
  // (otherwise L↔C is a command-structure mismatch and the browser snaps).
  GitGraph.prototype._edgePathD = function (x1, y1, x2, y2) {
    var midY = (y1 + y2) / 2;
    return 'M ' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + midY + ', ' + x2 + ' ' + midY + ', ' + x2 + ' ' + y2;
  };

  GitGraph.prototype._updateEdge = function (entry, x1, y1, x2, y2, color) {
    if (entry.x1 === x1 && entry.y1 === y1 && entry.x2 === x2 && entry.y2 === y2 && entry.color === color) return;
    entry.el.setAttribute('d', this._edgePathD(x1, y1, x2, y2));
    if (entry.el.style.strokeDasharray) {
      entry.el.style.strokeDasharray = '';
      entry.el.style.strokeDashoffset = '';
    }
    if (entry.color !== color) entry.el.setAttribute('stroke', color);
    entry.x1 = x1; entry.y1 = y1; entry.x2 = x2; entry.y2 = y2; entry.color = color;
  };

  // Retract-then-remove: mirror of _animateEdgeIn so merge-undo / reset /
  // rebase feels natural. We set strokeDasharray to the path length and
  // tween strokeDashoffset back to the length — the line gracefully un-draws
  // from parent toward child over the same 720ms used for position slides.
  GitGraph.prototype._removeEdge = function (entry, key) {
    if (entry._removalTimer) return;
    var self = this;
    var el = entry.el;
    var len;
    try {
      len = el.getTotalLength ? el.getTotalLength() : Math.hypot(entry.x2 - entry.x1, entry.y2 - entry.y1);
    } catch (e) {
      len = Math.hypot(entry.x2 - entry.x1, entry.y2 - entry.y1);
    }
    if (len && isFinite(len)) {
      el.style.strokeDasharray = len + 'px';
      el.style.strokeDashoffset = '0px';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          el.style.strokeDashoffset = len + 'px';
        });
      });
    }
    el.classList.add('exiting');
    entry._removalTimer = setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
      delete self._edgeEls[key];
    }, 720);
  };

  // ---- Nodes ----------------------------------------------------------------

  GitGraph.prototype._diffNodes = function (commits, head) {
    var newHashes = {};
    for (var i = 0; i < commits.length; i++) {
      var cm = commits[i];
      newHashes[cm.hash] = true;
      var cx = this._cx(cm.col);
      var cy = this._cy(cm.row);
      var isHead = (head.hash === cm.hash);

      var entry = this._nodeEls[cm.hash];
      if (!entry) {
        entry = this._createNode(cm, cx, cy, isHead);
        this._nodesLayer.appendChild(entry.g);
        this._nodeEls[cm.hash] = entry;
      } else {
        if (entry._removalTimer) {
          clearTimeout(entry._removalTimer);
          entry._removalTimer = null;
          entry.g.classList.remove('exiting');
        }
        this._updateNode(entry, cm, cx, cy, isHead);
      }
    }
    for (var h in this._nodeEls) {
      if (this._nodeEls.hasOwnProperty(h) && !newHashes[h] && !this._nodeEls[h]._removalTimer) {
        this._removeNode(this._nodeEls[h], h);
      }
    }
  };

  GitGraph.prototype._createNode = function (cm, cx, cy, isHead) {
    var classes = 'git-graph-node-g entering';
    if (isHead) classes += ' git-graph-node-head head-pulse';
    if (cm.parents && cm.parents.length >= 2) classes += ' git-graph-merge-burst';

    var g = this._svgEl('g', {
      'class': classes,
      'data-hash': cm.hash,
    });
    g.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';

    var glow = null;
    if (isHead) {
      glow = this._svgEl('circle', {
        cx: 0, cy: 0, r: NODE_RADIUS + 5,
        fill: 'none', stroke: cm.branchColor, 'stroke-width': 2, 'stroke-opacity': 0.4,
        'class': 'git-graph-head-glow',
      });
      g.appendChild(glow);
    }
    var circle = this._svgEl('circle', {
      cx: 0, cy: 0, r: NODE_RADIUS,
      fill: cm.branchColor, stroke: '#fff', 'stroke-width': 2.5,
      'class': 'git-graph-node',
    });
    g.appendChild(circle);

    var hashText = this._svgEl('text', {
      x: 0, y: 4, 'text-anchor': 'middle',
      fill: '#fff', 'font-size': 10, 'font-weight': 600,
      'class': 'git-graph-hash',
    });
    hashText.textContent = cm.shortHash;
    g.appendChild(hashText);

    var msgText = this._svgEl('text', {
      x: NODE_RADIUS + 24, y: 4,
      fill: 'var(--git-graph-text, #ccc)', 'font-size': 12,
      'class': 'git-graph-message',
    });
    msgText.textContent = this._truncate(cm.message, 50);
    g.appendChild(msgText);

    setTimeout(function () {
      g.classList.remove('entering');
      g.classList.remove('head-pulse');
      g.classList.remove('git-graph-merge-burst');
    }, 800);

    return {
      g: g, glow: glow, circle: circle, hashText: hashText, msgText: msgText,
      cx: cx, cy: cy, isHead: isHead, color: cm.branchColor,
      message: cm.message, shortHash: cm.shortHash,
    };
  };

  GitGraph.prototype._updateNode = function (entry, cm, cx, cy, isHead) {
    if (entry.cx !== cx || entry.cy !== cy) {
      entry.g.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';
      entry.cx = cx;
      entry.cy = cy;
    }
    if (entry.color !== cm.branchColor) {
      entry.circle.setAttribute('fill', cm.branchColor);
      if (entry.glow) entry.glow.setAttribute('stroke', cm.branchColor);
      entry.color = cm.branchColor;
    }
    if (entry.message !== cm.message) {
      entry.msgText.textContent = this._truncate(cm.message, 50);
      entry.message = cm.message;
    }
    if (entry.shortHash !== cm.shortHash) {
      entry.hashText.textContent = cm.shortHash;
      entry.shortHash = cm.shortHash;
    }
    if (entry.isHead !== isHead) {
      if (isHead) {
        if (!entry.glow) {
          entry.glow = this._svgEl('circle', {
            cx: 0, cy: 0, r: NODE_RADIUS + 5,
            fill: 'none', stroke: cm.branchColor, 'stroke-width': 2, 'stroke-opacity': 0.4,
            'class': 'git-graph-head-glow glow-entering',
          });
          entry.g.insertBefore(entry.glow, entry.circle);
          var newGlow = entry.glow;
          setTimeout(function () { newGlow.classList.remove('glow-entering'); }, 900);
        }
        entry.g.classList.add('git-graph-node-head', 'head-pulse');
        var gRef = entry.g;
        setTimeout(function () { gRef.classList.remove('head-pulse'); }, 900);
      } else {
        if (entry.glow && entry.glow.parentNode) {
          var oldGlow = entry.glow;
          oldGlow.classList.add('glow-exiting');
          setTimeout(function () {
            if (oldGlow.parentNode) oldGlow.parentNode.removeChild(oldGlow);
          }, 720);
          entry.glow = null;
        }
        entry.g.classList.remove('git-graph-node-head', 'head-pulse');
      }
      entry.isHead = isHead;
    }
  };

  GitGraph.prototype._removeNode = function (entry, hash) {
    if (entry._removalTimer) return;
    var self = this;
    entry.g.classList.add('exiting');
    entry._removalTimer = setTimeout(function () {
      if (entry.g.parentNode) entry.g.parentNode.removeChild(entry.g);
      delete self._nodeEls[hash];
    }, 450);
  };

  // ---- Labels (branches + HEAD) ---------------------------------------------

  GitGraph.prototype._diffLabels = function (branches, commitMap, head) {
    var byCommit = {};
    for (var i = 0; i < branches.length; i++) {
      var br = branches[i];
      if (!byCommit[br.hash]) byCommit[br.hash] = [];
      byCommit[br.hash].push(br);
    }

    var newKeys = {};
    // Baking the stack offset into the wrapper's transform (instead of the
    // inner content's labelY) means when a label's stackIdx changes —
    // e.g. fast-forward merge brings main to a commit feature already
    // occupies, pushing main to stack position 1 — the transform still
    // interpolates smoothly from old Y to new Y, matching HEAD's wrapper
    // which already does this. Otherwise main snaps 28px at render time
    // while HEAD animates, creating visible desync.
    for (var hash in byCommit) {
      if (!byCommit.hasOwnProperty(hash)) continue;
      var labels = byCommit[hash];
      var commit = commitMap[hash];
      if (!commit) continue;
      var cx = this._cx(commit.col);
      var cy = this._cy(commit.row);
      for (var l = 0; l < labels.length; l++) {
        var br2 = labels[l];
        var key = 'branch:' + br2.name;
        newKeys[key] = true;
        var stackIdx = labels.length - 1 - l;
        var wrapperY = cy - stackIdx * (LABEL_HEIGHT + LABEL_GAP);
        var commitRelY = cy - wrapperY;
        this._renderLabelGroup(key, cx, wrapperY, function (g, gThis) {
          gThis._buildBranchLabelContent(g, br2.name, gThis._branchColors[br2.name] || BRANCH_COLORS[0], commitRelY);
        });
      }
    }

    // HEAD as its own persistent label so attached↔detached transitions
    // can slide smoothly via the wrapper transform instead of being baked
    // into the branch label content (which would force a snap rebuild).
    if (head.hash && commitMap[head.hash]) {
      var key2 = 'head';
      newKeys[key2] = true;
      var hCommit = commitMap[head.hash];
      var hcx = this._cx(hCommit.col);
      var hcy = this._cy(hCommit.row);
      var PTR_DEPTH_H = LABEL_HEIGHT / 2;
      var TIP_TO_NODE_H = 4;
      var HEAD_GAP_H = 4;
      var wrapperX, wrapperY, isDetached, color;
      if (head.detached) {
        isDetached = true;
        color = '#f39c12';
        var stackIdxD = byCommit[head.hash] ? byCommit[head.hash].length : 0;
        wrapperX = hcx - NODE_RADIUS - TIP_TO_NODE_H;
        wrapperY = hcy + stackIdxD * (LABEL_HEIGHT + LABEL_GAP);
      } else {
        isDetached = false;
        color = this._branchColors[head.ref] || BRANCH_COLORS[0];
        var siblings = byCommit[head.hash] || [];
        var headBranchPos = -1;
        for (var sb = 0; sb < siblings.length; sb++) {
          if (siblings[sb].name === head.ref) { headBranchPos = sb; break; }
        }
        var stackIdxA = (headBranchPos >= 0) ? (siblings.length - 1 - headBranchPos) : 0;
        var brW = (head.ref || '').length * 7.5 + 16 + PTR_DEPTH_H;
        wrapperX = hcx - NODE_RADIUS - TIP_TO_NODE_H - brW - HEAD_GAP_H;
        wrapperY = hcy - stackIdxA * (LABEL_HEIGHT + LABEL_GAP);
      }
      var commitRelX = hcx - wrapperX;
      var commitRelY = hcy - wrapperY;
      this._renderLabelGroup(key2, wrapperX, wrapperY, function (g, gThis) {
        gThis._buildHeadContent(g, isDetached, color, commitRelX, commitRelY);
      }, 'git-graph-label-g--head');
    }

    for (var k in this._labelEls) {
      if (this._labelEls.hasOwnProperty(k) && !newKeys[k] && !this._labelEls[k]._removalTimer) {
        this._removeLabel(this._labelEls[k], k);
      }
    }
  };

  GitGraph.prototype._renderLabelGroup = function (key, cx, cy, fillFn, extraClass) {
    var entry = this._labelEls[key];
    var self = this;
    if (!entry) {
      var classes = 'git-graph-label-g entering' + (extraClass ? ' ' + extraClass : '');
      var g = this._svgEl('g', {
        'class': classes,
        'data-label-key': key,
      });
      g.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';
      this._labelsLayer.appendChild(g);
      entry = { g: g, cx: cx, cy: cy };
      this._labelEls[key] = entry;
      setTimeout(function () { g.classList.remove('entering'); }, 400);
    } else {
      if (entry._removalTimer) {
        clearTimeout(entry._removalTimer);
        entry._removalTimer = null;
        entry.g.classList.remove('exiting');
      }
      if (entry.cx !== cx || entry.cy !== cy) {
        entry.g.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';
        entry.cx = cx;
        entry.cy = cy;
      }
    }
    while (entry.g.firstChild) entry.g.removeChild(entry.g.firstChild);
    fillFn(entry.g, self);
  };

  // Label content is drawn centered at wrapper origin (y=0); the stack offset
  // lives in the wrapper transform instead so it can animate smoothly.
  // commitRelY is the commit's y in wrapper-local coords — used by the
  // dashed L-connector to route from the label tip (y=0) down/up to the
  // actual commit position.
  GitGraph.prototype._buildBranchLabelContent = function (g, name, color, commitRelY) {
    var PTR_DEPTH = LABEL_HEIGHT / 2;
    var TIP_TO_NODE = 4;

    var labelY = -LABEL_HEIGHT / 2;
    var labelMidY = 0;
    var textW = name.length * 7.5 + 16;
    var brW = textW + PTR_DEPTH;

    var tipXL = -NODE_RADIUS - TIP_TO_NODE;
    var brXL = tipXL - brW;
    var brD = this._pointerPath(brXL, labelY, brW, LABEL_HEIGHT);
    g.appendChild(this._svgEl('path', {
      d: brD,
      fill: 'var(--git-graph-bg, #fafbfc)', stroke: 'none',
      'class': 'git-graph-label-bg',
    }));
    g.appendChild(this._svgEl('path', {
      d: brD,
      fill: color, 'fill-opacity': 0.22, stroke: color, 'stroke-width': 1.5,
    }));
    var tL = this._svgEl('text', {
      x: brXL + textW / 2, y: labelMidY + 4,
      'text-anchor': 'middle', fill: color, 'font-size': 11, 'font-weight': 700,
      'class': 'git-graph-branch-label',
    });
    tL.textContent = name;
    g.appendChild(tL);
    g.appendChild(this._lConnectorEl(tipXL, labelMidY, -NODE_RADIUS - 2, commitRelY || 0, color, true));
  };

  GitGraph.prototype._buildHeadContent = function (g, isDetached, color, commitRelX, commitRelY) {
    var PTR_DEPTH = LABEL_HEIGHT / 2;
    var headTextW = 4 * 7.5 + 16;
    var headW = headTextW + PTR_DEPTH;
    var fillColor = isDetached ? color : '#ffffff';
    var fillOpacity = isDetached ? 0.25 : 0.95;
    var textColor = isDetached ? color : '#1a1a1a';

    var d = this._pointerPath(-headW, -LABEL_HEIGHT / 2, headW, LABEL_HEIGHT);

    g.appendChild(this._svgEl('path', {
      d: d,
      fill: 'var(--git-graph-bg, #fafbfc)', stroke: 'none',
      'class': 'git-graph-label-bg',
    }));
    g.appendChild(this._svgEl('path', {
      d: d,
      fill: fillColor, 'fill-opacity': fillOpacity,
      stroke: color, 'stroke-width': 1.5,
      'class': 'git-graph-head-chip',
    }));
    var t = this._svgEl('text', {
      x: -PTR_DEPTH - headTextW / 2, y: 4,
      'text-anchor': 'middle', fill: textColor,
      'font-size': 11, 'font-weight': 700,
      'class': 'git-graph-head-text',
    });
    t.textContent = 'HEAD';
    g.appendChild(t);

    if (isDetached) {
      g.appendChild(this._lConnectorEl(0, 0, commitRelX - NODE_RADIUS - 2, commitRelY, color, true));
    } else {
      g.appendChild(this._svgEl('line', {
        x1: 0, y1: 0, x2: 4, y2: 0,
        stroke: color, 'stroke-width': 1.5,
        'class': 'git-graph-head-connector-attached',
      }));
    }
  };

  GitGraph.prototype._lConnectorEl = function (x1, y1, x2, y2, color, horizFirst) {
    if (Math.abs(y1 - y2) < 1) {
      return this._svgEl('line', {
        x1: x1, y1: y1, x2: x2, y2: y2,
        stroke: color, 'stroke-width': 1.5, 'stroke-opacity': 0.6, 'stroke-dasharray': '3,2',
      });
    }
    var pts = horizFirst
      ? (x1 + ',' + y1 + ' ' + x2 + ',' + y1 + ' ' + x2 + ',' + y2)
      : (x1 + ',' + y1 + ' ' + x1 + ',' + y2 + ' ' + x2 + ',' + y2);
    return this._svgEl('polyline', {
      points: pts, fill: 'none', stroke: color,
      'stroke-width': 1.5, 'stroke-opacity': 0.6, 'stroke-dasharray': '3,2',
    });
  };

  GitGraph.prototype._removeLabel = function (entry, key) {
    if (entry._removalTimer) return;
    var self = this;
    entry.g.classList.add('exiting');
    entry._removalTimer = setTimeout(function () {
      if (entry.g.parentNode) entry.g.parentNode.removeChild(entry.g);
      delete self._labelEls[key];
    }, 350);
  };

  /**
   * Static convenience: render data to an SVG string without allocating
   * a real container. Useful for embedding inside other renderers.
   */
  GitGraph.renderToSVG = function (data) {
    return new GitGraph(null).toSVG(data);
  };

  GitGraph.prototype._cx = function (col) {
    return PADDING_LEFT + col * COL_WIDTH;
  };

  GitGraph.prototype._cy = function (row) {
    return PADDING_TOP + row * ROW_HEIGHT;
  };

  GitGraph.prototype._renderEdges = function (commits, commitMap) {
    var svg = '';
    for (var i = 0; i < commits.length; i++) {
      var cm = commits[i];
      var x1 = this._cx(cm.col);
      var y1 = this._cy(cm.row);

      for (var p = 0; p < cm.parents.length; p++) {
        var parent = commitMap[cm.parents[p]];
        if (!parent) continue;
        var x2 = this._cx(parent.col);
        var y2 = this._cy(parent.row);
        var color = cm.branchColor;

        if (x1 === x2) {
          // Straight line (same column)
          svg += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" ' +
            'stroke="' + color + '" stroke-width="3" stroke-opacity="0.7"/>';
        } else {
          // Curved line (cross-column merge/branch)
          var midY = (y1 + y2) / 2;
          svg += '<path d="M ' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + midY + ', ' +
            x2 + ' ' + midY + ', ' + x2 + ' ' + y2 + '" ' +
            'fill="none" stroke="' + color + '" stroke-width="3" stroke-opacity="0.7"/>';
        }
      }
    }
    return svg;
  };

  GitGraph.prototype._renderNodes = function (commits, head) {
    var svg = '';
    for (var i = 0; i < commits.length; i++) {
      var cm = commits[i];
      var cx = this._cx(cm.col);
      var cy = this._cy(cm.row);
      var color = cm.branchColor;
      var isHead = (head.hash === cm.hash);

      // Glow effect for HEAD
      if (isHead) {
        svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (NODE_RADIUS + 5) + '" ' +
          'fill="none" stroke="' + color + '" stroke-width="2" stroke-opacity="0.4" ' +
          'class="git-graph-head-glow"/>';
      }

      // Main node circle
      svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + NODE_RADIUS + '" ' +
        'fill="' + color + '" stroke="#fff" stroke-width="2.5" class="git-graph-node"/>';

      var shortName = cm.hash.length === 1;
      var hashFont = shortName ? 18 : 10;
      var hashY    = shortName ? 6  : 4;
      var hashStr  = shortName ? cm.hash : cm.shortHash;
      svg += '<text x="' + cx + '" y="' + (cy + hashY) + '" text-anchor="middle" ' +
        'fill="#fff" font-size="' + hashFont + '" font-weight="700" class="git-graph-hash">' +
        this._escapeXml(hashStr) + '</text>';

      var msgX = cx + NODE_RADIUS + 24;
      svg += '<text x="' + msgX + '" y="' + (cy + 4) + '" ' +
        'fill="var(--git-graph-text, #ccc)" font-size="12" class="git-graph-message">' +
        this._escapeXml(this._truncate(cm.message, 50)) + '</text>';
    }
    return svg;
  };

  GitGraph.prototype._renderBranchLabels = function (branches, commitMap, head) {
    var self = this;
    var svg = '';

    var PTR_DEPTH           = LABEL_HEIGHT / 2;
    var TIP_TO_NODE         = 4;
    var HEAD_GAP            = 4;
    var HEAD_COLOR          = '#ffffff';
    var HEAD_DETACHED_COLOR = '#f39c12';
    var LABEL_BG            = 'var(--git-graph-bg, #1a1a2e)';

    // Group labels by commit hash
    var labelsByCommit = {};
    for (var i = 0; i < branches.length; i++) {
      var br = branches[i];
      var commit = commitMap[br.hash];
      if (!commit) continue;
      if (!labelsByCommit[br.hash]) labelsByCommit[br.hash] = [];
      labelsByCommit[br.hash].push(br);
    }

    // Dashed L-connector.
    // LEFT side  (horizFirst=true):  horizontal → vertical  (left label → right node)
    // RIGHT side (horizFirst=false): vertical → horizontal  (left node  → right label)
    function lConnector(x1, y1, x2, y2, color, horizFirst) {
      if (Math.abs(y1 - y2) < 1) {
        return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" ' +
          'stroke="' + color + '" stroke-width="1.5" stroke-opacity="0.6" stroke-dasharray="3,2"/>';
      }
      var pts = horizFirst
        ? (x1 + ',' + y1 + ' ' + x2 + ',' + y1 + ' ' + x2 + ',' + y2)   // horiz first
        : (x1 + ',' + y1 + ' ' + x1 + ',' + y2 + ' ' + x2 + ',' + y2);  // vert first
      return '<polyline points="' + pts + '" fill="none" stroke="' + color + '" ' +
        'stroke-width="1.5" stroke-opacity="0.6" stroke-dasharray="3,2"/>';
    }

    for (var hash in labelsByCommit) {
      if (!labelsByCommit.hasOwnProperty(hash)) continue;
      var labels = labelsByCommit[hash];
      var commit = commitMap[hash];
      var cx = this._cx(commit.col);
      var cy = this._cy(commit.row);

      for (var l = 0; l < labels.length; l++) {
        var br          = labels[l];
        var isHeadBr    = (!head.detached && head.ref === br.name);
        var color       = this._branchColors[br.name] || BRANCH_COLORS[0];
        var labelY      = cy - LABEL_HEIGHT / 2 - (labels.length - 1 - l) * (LABEL_HEIGHT + LABEL_GAP);
        var labelMidY   = labelY + LABEL_HEIGHT / 2;
        var textW       = br.name.length * 7.5 + 16;
        var brW         = textW + PTR_DEPTH;
        var tipX        = cx - NODE_RADIUS - TIP_TO_NODE;
        var brX         = tipX - brW;
        var brD         = this._pointerPath(brX, labelY, brW, LABEL_HEIGHT);

        svg += '<path d="' + brD + '" fill="' + LABEL_BG + '" stroke="none"/>';
        svg += '<path d="' + brD + '" ' +
          'fill="' + color + '" fill-opacity="0.22" stroke="' + color + '" stroke-width="1.5"/>';
        svg += '<text x="' + (brX + textW / 2) + '" y="' + (labelMidY + 4) + '" ' +
          'text-anchor="middle" fill="' + color + '" font-size="11" font-weight="700" ' +
          'class="git-graph-branch-label">' + this._escapeXml(br.name) + '</text>';
        svg += lConnector(tipX, labelMidY, cx - NODE_RADIUS - 2, cy, color, true);

        if (isHeadBr) {
          var headTextW = 4 * 7.5 + 16;
          var headW     = headTextW + PTR_DEPTH;
          var headTipX  = brX - HEAD_GAP;
          var headX     = headTipX - headW;
          var headD     = this._pointerPath(headX, labelY, headW, LABEL_HEIGHT);

          svg += '<path d="' + headD + '" fill="' + LABEL_BG + '" stroke="none"/>';
          svg += '<path d="' + headD + '" ' +
            'fill="' + HEAD_COLOR + '" fill-opacity="0.95" stroke="' + color + '" stroke-width="1.5"/>';
          svg += '<text x="' + (headX + headTextW / 2) + '" y="' + (labelMidY + 4) + '" ' +
            'text-anchor="middle" fill="#1a1a1a" font-size="11" font-weight="700">HEAD</text>';
          svg += '<line x1="' + headTipX + '" y1="' + labelMidY + '" ' +
            'x2="' + brX + '" y2="' + labelMidY + '" stroke="' + color + '" stroke-width="1.5"/>';
        }
      }
    }

    if (head.detached && head.hash && commitMap[head.hash]) {
      var hCommit    = commitMap[head.hash];
      var hcx        = this._cx(hCommit.col);
      var hcy        = this._cy(hCommit.row);
      var DC         = HEAD_DETACHED_COLOR;
      var htextW     = 4 * 7.5 + 16;
      var hW         = htextW + PTR_DEPTH;
      var hlabelY    = hcy - LABEL_HEIGHT / 2;
      var hlabelMidY = hcy;

      if (labelsByCommit[head.hash]) {
        hlabelY    += labelsByCommit[head.hash].length * (LABEL_HEIGHT + LABEL_GAP);
        hlabelMidY  = hlabelY + LABEL_HEIGHT / 2;
      }

      var htipX = hcx - NODE_RADIUS - TIP_TO_NODE;
      var hX    = htipX - hW;
      var hD    = this._pointerPath(hX, hlabelY, hW, LABEL_HEIGHT);
      svg += '<path d="' + hD + '" fill="' + LABEL_BG + '" stroke="none"/>';
      svg += '<path d="' + hD + '" ' +
        'fill="' + DC + '" fill-opacity="0.25" stroke="' + DC + '" stroke-width="1.5"/>';
      svg += '<text x="' + (hX + htextW / 2) + '" y="' + (hlabelMidY + 4) + '" ' +
        'text-anchor="middle" fill="' + DC + '" font-size="11" font-weight="700">HEAD</text>';
      svg += lConnector(htipX, hlabelMidY, hcx - NODE_RADIUS - 2, hcy, DC, true);
    }

    return svg;
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  GitGraph.prototype._escapeXml = function (str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  GitGraph.prototype._truncate = function (str, max) {
    return str.length > max ? str.substring(0, max - 1) + '\u2026' : str;
  };

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  window.GitGraph = GitGraph;
})();
