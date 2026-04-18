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
  var PADDING_BOTTOM = 4;
  var LABEL_OFFSET_X = 34;
  var LABEL_HEIGHT = 24;
  var LABEL_GAP = 4;

  // Lateral separation (in user pixels) between arrow landing points when
  // multiple children share a parent. Wide enough that the 13×12 filled
  // arrowheads (markerWidth × markerHeight) don't overlap.
  var ARROW_FAN_SEPARATION = 14;
  // Maximum lateral offset as a fraction of NODE_RADIUS — keeps landing
  // points well within the upper arc so the arrow still reads as "pointing
  // at the parent" rather than glancing off the side.
  var ARROW_MAX_FAN_FRAC = 0.72;
  // Arrow marker length (must match markerWidth). The path is shortened by
  // this amount so the stroke terminates at the arrow's BASE rather than
  // running through the chevron's interior.
  var ARROW_LENGTH = 13;

  // Each GitGraph gets a unique arrow-marker id so multiple graphs on the
  // same page (e.g. the 7-step print grid) don't collide on element ids.
  var _instanceCounter = 0;

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------
  function GitGraph(container) {
    this.container = container;
    this.svg = null;
    this._data = null;
    this._animating = false;
    this._arrowId = 'git-graph-arrow-' + (++_instanceCounter);
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
   * Optional filesSpec describes working-tree / index / stash state and is
   * normalized into a `workingTree` field on the returned state. Omitted or
   * null filesSpec means no workbench strip is rendered.
   *
   * Returns { commits, branches, head, commitMap, workingTree }
   */
  var VALID_STATUSES = {
    'modified': 1, 'new file': 1, 'deleted': 1, 'renamed': 1, 'typechange': 1, 'unmerged': 1,
  };
  var STATUS_SHORT_MAP = { 'M': 'modified', 'A': 'new file', 'D': 'deleted', 'R': 'renamed', 'T': 'typechange', 'U': 'unmerged' };

  function _normalizeFileEntry(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') {
      // Either "M:path/to/file" shorthand or a bare filename (treated as untracked only).
      var colonIdx = entry.indexOf(':');
      if (colonIdx > 0 && colonIdx <= 12) {
        var prefix = entry.substring(0, colonIdx).trim();
        var rest = entry.substring(colonIdx + 1).trim();
        var status = STATUS_SHORT_MAP[prefix] || (VALID_STATUSES[prefix] ? prefix : null);
        if (status && rest) return { status: status, path: rest };
      }
      return { path: entry };
    }
    if (typeof entry === 'object' && entry.path) {
      return {
        status: entry.status && VALID_STATUSES[entry.status] ? entry.status : undefined,
        path: entry.path,
      };
    }
    return null;
  }

  function _normalizeStashEntry(entry, idx) {
    if (!entry) return null;
    if (typeof entry === 'string') {
      // Support "WIP on main: message" shorthand or bare message.
      var m = entry.match(/^(?:WIP\s+on\s+)?([^:]+?):\s*(.*)$/);
      if (m) return { ref: 'stash@{' + idx + '}', branch: m[1].trim(), message: m[2] };
      return { ref: 'stash@{' + idx + '}', branch: '', message: entry };
    }
    if (typeof entry === 'object') {
      return {
        ref: entry.ref || ('stash@{' + idx + '}'),
        branch: entry.branch || '',
        message: entry.message || '',
      };
    }
    return null;
  }

  function _normalizeFilesSpec(spec) {
    // Null/undefined spec → no workbench at all (existing labs that don't
    // declare `files` are unchanged).
    if (spec === null || spec === undefined) return null;
    if (typeof spec !== 'object') return null;
    var wt = { untracked: [], unstaged: [], staged: [], stashed: [] };
    var zones = ['untracked', 'unstaged', 'staged'];
    for (var z = 0; z < zones.length; z++) {
      var zone = zones[z];
      var src = spec[zone];
      if (!src || !src.length) continue;
      for (var i = 0; i < src.length; i++) {
        var norm = _normalizeFileEntry(src[i]);
        if (norm) wt[zone].push(norm);
      }
    }
    var stashSrc = spec.stashed || [];
    for (var s = 0; s < stashSrc.length; s++) {
      var st = _normalizeStashEntry(stashSrc[s], s);
      if (st) wt.stashed.push(st);
    }
    // A spec declared explicitly (even with all arrays empty) still renders
    // the strip — pedagogically meaningful for transitions like
    // `git reset --hard` where "everything is now clean" is the point.
    return wt;
  }

  // Expose for the command-lab to probe/normalize outside parseGitState.
  GitGraph._normalizeFilesSpec = _normalizeFilesSpec;

  GitGraph.parseGitState = function (logOutput, branchOutput, headRef, filesSpec) {
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

      // Short synthetic hashes used by the SEBook command-lab ("A0000…0",
      // "C'0000…0", "B+C+D0000…0") are displayed verbatim — strip the zero
      // padding. Real git hashes get the traditional first-4-chars-plus-
      // ellipsis treatment. The 8-char cap on the trimmed form is generous
      // enough to fit concatenations like "B+C+D" from squash demos.
      var trimmed = hash.replace(/0+$/, '');
      var shortHash = (trimmed.length > 0 && trimmed.length <= 8)
        ? trimmed
        : hash.substring(0, 4) + '\u2026';

      var commit = {
        hash: hash,
        shortHash: shortHash,
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
    var remoteSet = {};
    for (var d = 0; d < commits.length; d++) {
      var dec = commits[d].decorations;
      if (!dec) continue;
      // Parse decoration string: "HEAD -> main, origin/main, feature"
      var decParts = dec.split(',');
      for (var dp = 0; dp < decParts.length; dp++) {
        var decPart = decParts[dp].trim();
        // Remove "HEAD -> " prefix
        decPart = decPart.replace(/^HEAD\s*->\s*/, '');
        // Skip tag: prefixes; include origin/ remotes as remote-tracking labels
        if (decPart.startsWith('tag:')) continue;
        if (decPart && decPart !== 'HEAD') {
          branchMap[decPart] = commits[d].hash;
          if (decPart.startsWith('origin/')) remoteSet[decPart] = true;
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
        branches.push({ name: name, hash: branchMap[name], remote: !!remoteSet[name] });
      }
    }

    return {
      commits: commits,
      branches: branches,
      head: head,
      commitMap: commitMap,
      workingTree: _normalizeFilesSpec(filesSpec),
    };
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
    var REMOTE_COLOR = '#8b949e'; // grey for remote-tracking branches (origin/*) with no local counterpart
    var branchColors = {};
    // Pass 1: color local branches first.
    for (var bi = 0; bi < branches.length; bi++) {
      var bname = branches[bi].name;
      if (branches[bi].remote) continue;
      var colorIdx = this._hashString(bname) % BRANCH_COLORS.length;
      branchColors[bname] = BRANCH_COLORS[colorIdx];
    }
    // Ensure 'main' and 'master' get UCLA Blue
    if (branchColors['main']) branchColors['main'] = BRANCH_COLORS[0];
    if (branchColors['master']) branchColors['master'] = BRANCH_COLORS[0];
    // Pass 2: remote-tracking branches inherit the color of their local
    // counterpart so commits on `origin/main` read as the same "main lane"
    // as local `main`. Only fall back to grey when there is no local branch
    // of the same short name.
    for (var bi2 = 0; bi2 < branches.length; bi2++) {
      var bname2 = branches[bi2].name;
      if (!branches[bi2].remote) continue;
      var slashIdx = bname2.indexOf('/');
      var shortName = slashIdx >= 0 ? bname2.substring(slashIdx + 1) : bname2;
      branchColors[bname2] = branchColors[shortName] || REMOTE_COLOR;
    }

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
    // Seed remote branches first, then local — local always wins for shared hashes.
    for (var bt = 0; bt < branches.length; bt++) {
      if (branches[bt].remote) commitBranch[branches[bt].hash] = branches[bt].name;
    }
    for (var bt2 = 0; bt2 < branches.length; bt2++) {
      if (!branches[bt2].remote) commitBranch[branches[bt2].hash] = branches[bt2].name;
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
    var HEAD_W   = (4 * 8.5 + 18) + PTR_D; // "HEAD" label full width
    for (var rb = 0; rb < branches.length; rb++) {
      var rbName   = branches[rb].name;
      var rbCommit = commitMap[branches[rb].hash];
      if (!rbCommit || rbCommit.col === 0) continue;
      var brTipX  = PADDING_LEFT + rbCommit.col * COL_WIDTH + NODE_RADIUS + 10; // TIP_TO_NODE=10
      var brW     = rbName.length * 8.5 + 18 + PTR_D;
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

  // ---------------------------------------------------------------------------
  // Arrow marker — pointing from child toward parent.
  //
  // We rely on SVG2's `context-stroke` keyword so a single marker inherits
  // each edge's stroke color. Supported in Firefox, Safari 16.4+, and Chrome
  // 130+ (late 2024) — fine for this project's audience.
  // ---------------------------------------------------------------------------
  // Closed, filled arrowhead. Each wing is a quadratic curve for a slim
  // feather silhouette, and the back edge has a subtle concave notch
  // (control point pulled toward the tip) so the arrow reads as a classic
  // pointed glyph rather than a flat-backed triangle — the shape design
  // systems reach for when they want an arrow that feels decisive and
  // refined. Fill uses `context-stroke` so each edge's branch color shows
  // through automatically.
  var ARROW_PATH = 'M 0 0 Q 6.5 4, 13 6 Q 6.5 8, 0 12 Q 2.8 6, 0 0 Z';

  GitGraph.prototype._arrowDefsMarkup = function () {
    return '<defs><marker id="' + this._arrowId + '" ' +
      'viewBox="0 0 13 12" refX="0" refY="6" ' +
      'markerWidth="13" markerHeight="12" orient="auto" ' +
      'markerUnits="userSpaceOnUse">' +
      '<path d="' + ARROW_PATH + '" fill="context-stroke" stroke="none"/>' +
      '</marker></defs>';
  };

  GitGraph.prototype._appendArrowDefs = function (svgRoot) {
    var defs = this._svgEl('defs');
    var marker = this._svgEl('marker', {
      id: this._arrowId,
      viewBox: '0 0 13 12',
      refX: 0, refY: 6,
      markerWidth: 13, markerHeight: 12,
      orient: 'auto',
      markerUnits: 'userSpaceOnUse',
    });
    var arrowPath = this._svgEl('path', {
      d: ARROW_PATH,
      fill: 'context-stroke',
      stroke: 'none',
    });
    marker.appendChild(arrowPath);
    defs.appendChild(marker);
    svgRoot.appendChild(defs);
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

    svg += this._arrowDefsMarkup();

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
      if (data && data.workingTree) this._diffWorkbench(data);
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
    return Math.ceil(max * 8);
  };

  GitGraph.prototype._buildInitialSvg = function (dims) {
    if (!this.container) return;
    // Preserve an existing workbench (rendered via _diffWorkbench) so the
    // SVG rebuild doesn't wipe it. Other children (legacy SVG, empty state)
    // are cleared.
    var children = Array.prototype.slice.call(this.container.children);
    for (var ci = 0; ci < children.length; ci++) {
      if (children[ci] !== this._workbenchEl) {
        this.container.removeChild(children[ci]);
      }
    }
    this._svgRoot = this._svgEl('svg', {
      xmlns: SVG_NS,
      width: dims.width,
      height: dims.height,
      viewBox: '0 0 ' + dims.width + ' ' + dims.height,
      'class': 'git-graph-svg',
      style: "font-family:'Fira Code','Cascadia Code',Menlo,monospace;",
    });
    this._appendArrowDefs(this._svgRoot);
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
    this._diffWorkbench(data);
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
        var ep = this._edgeEndpoint(cm, parent, commitMap);
        required.push({
          cm: cm, parent: parent,
          key: cm.hash + '__' + cm.parents[p],
          x1: this._cx(cm.col), y1: this._cy(cm.row),
          x2: ep.x, y2: ep.y,
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
      'marker-end': 'url(#' + this._arrowId + ')',
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
  // Compute the edge's actual path endpoint — already adjusted so the
  // arrow tip lands ON the parent node's border (not short of it) and, when
  // multiple children share a parent, each edge lands at a distinct point
  // on the parent's upper (or lower) arc so the arrowheads don't collide.
  GitGraph.prototype._edgeEndpoint = function (cm, parent, commitMap) {
    var px = this._cx(parent.col);
    var py = this._cy(parent.row);
    var cy = this._cy(cm.row);
    var dir = py >= cy ? 1 : -1;

    // Lateral offset across the arc when siblings share this parent.
    var siblings = (parent.children || [])
      .map(function (h) { return commitMap[h]; })
      .filter(function (c) { return !!c; })
      .sort(function (a, b) {
        if (a.col !== b.col) return a.col - b.col;
        return a.row - b.row;
      });
    var N = siblings.length;
    var slot = 0;
    for (var i = 0; i < N; i++) {
      if (siblings[i].hash === cm.hash) { slot = i; break; }
    }
    var offsetX = 0;
    if (N > 1) {
      offsetX = (slot - (N - 1) / 2) * ARROW_FAN_SEPARATION;
      var maxOff = NODE_RADIUS * ARROW_MAX_FAN_FRAC;
      if (offsetX >  maxOff) offsetX =  maxOff;
      if (offsetX < -maxOff) offsetX = -maxOff;
    }

    // Arrow tip position — on the circle's arc at x = px + offsetX.
    var arcDy = Math.sqrt(Math.max(0, NODE_RADIUS * NODE_RADIUS - offsetX * offsetX));
    var tipY  = py - dir * arcDy;
    // Path endpoint = arrow base, ARROW_LENGTH upstream of the tip along
    // the direction of travel. Keeping a vertical final tangent (same x)
    // means the filled chevron points straight at the parent.
    return { x: px + offsetX, y: tipY - dir * ARROW_LENGTH };
  };

  GitGraph.prototype._edgePathD = function (x1, y1, x2, y2) {
    // Cubic Bézier with vertical tangent at both ends. The endpoint
    // (x2, y2) is already pre-adjusted by _edgeEndpoint so the arrow tip
    // lands precisely on the parent's circumference.
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
    var classes = 'git-graph-node-g entering git-graph-merge-burst';
    if (isHead) classes += ' git-graph-node-head head-pulse';

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
      x: 0, y: 5, 'text-anchor': 'middle',
      fill: '#fff', 'font-size': 11, 'font-weight': 600,
      'class': 'git-graph-hash',
    });
    hashText.textContent = cm.shortHash;
    g.appendChild(hashText);

    var msgText = this._svgEl('text', {
      x: NODE_RADIUS + 24, y: 5,
      fill: 'var(--git-graph-text, #ccc)', 'font-size': 13,
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
        this._renderLabelGroup(key, cx, wrapperY, br2.hash, function (g, gThis) {
          gThis._buildBranchLabelContent(g, br2.name, gThis._branchColors[br2.name] || BRANCH_COLORS[0], commitRelY, br2.remote);
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
        var brW = (head.ref || '').length * 8.5 + 18 + PTR_DEPTH_H;
        wrapperX = hcx - NODE_RADIUS - TIP_TO_NODE_H - brW - HEAD_GAP_H;
        wrapperY = hcy - stackIdxA * (LABEL_HEIGHT + LABEL_GAP);
      }
      var commitRelX = hcx - wrapperX;
      var commitRelY = hcy - wrapperY;
      // HEAD's "target" is the commit AND the ref it's attached to, so a
      // `git switch` that moves HEAD between branches pointing at the same
      // commit still bursts (the commit id alone wouldn't tell us HEAD
      // moved). Detached state is encoded too so attached<->detached
      // transitions always flash.
      var headTargetId = head.hash + '@' + (head.detached ? '(detached)' : head.ref);
      this._renderLabelGroup(key2, wrapperX, wrapperY, headTargetId, function (g, gThis) {
        gThis._buildHeadContent(g, isDetached, color, commitRelX, commitRelY);
      }, 'git-graph-label-g--head');
    }

    for (var k in this._labelEls) {
      if (this._labelEls.hasOwnProperty(k) && !newKeys[k] && !this._labelEls[k]._removalTimer) {
        this._removeLabel(this._labelEls[k], k);
      }
    }
  };

  GitGraph.prototype._renderLabelGroup = function (key, cx, cy, targetHash, fillFn, extraClass) {
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
      entry = { g: g, cx: cx, cy: cy, targetHash: targetHash };
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
      // Yellow flash only when the pointer actually retargets to a different
      // commit (checkout, fast-forward, reset, rebase). A position shift
      // caused purely by layout reshuffling of the underlying commit is not
      // a "move" of the pointer itself.
      if (entry.targetHash !== targetHash) {
        entry.targetHash = targetHash;
        entry.g.classList.add('git-graph-label-burst');
        var gRef = entry.g;
        setTimeout(function () { gRef.classList.remove('git-graph-label-burst'); }, 800);
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
  GitGraph.prototype._buildBranchLabelContent = function (g, name, color, commitRelY, isRemote) {
    var PTR_DEPTH = LABEL_HEIGHT / 2;
    var TIP_TO_NODE = 4;

    var labelY = -LABEL_HEIGHT / 2;
    var labelMidY = 0;
    var textW = name.length * 8.5 + 18;
    var brW = textW + PTR_DEPTH;

    var tipXL = -NODE_RADIUS - TIP_TO_NODE;
    var brXL = tipXL - brW;
    var brD = this._pointerPath(brXL, labelY, brW, LABEL_HEIGHT);
    g.appendChild(this._svgEl('path', {
      d: brD,
      fill: 'var(--git-graph-bg, #fafbfc)', stroke: 'none',
      'class': 'git-graph-label-bg',
    }));
    var borderAttrs = {
      d: brD,
      fill: color, 'fill-opacity': isRemote ? 0.10 : 0.22,
      stroke: color, 'stroke-width': 1.5,
    };
    if (isRemote) borderAttrs['stroke-dasharray'] = '4 3';
    g.appendChild(this._svgEl('path', borderAttrs));
    var tL = this._svgEl('text', {
      x: brXL + textW / 2, y: labelMidY + 4,
      'text-anchor': 'middle', fill: color, 'font-size': 13,
      'font-weight': isRemote ? 400 : 700, 'font-style': isRemote ? 'italic' : 'normal',
      'class': 'git-graph-branch-label',
    });
    tL.textContent = name;
    g.appendChild(tL);
    g.appendChild(this._lConnectorEl(tipXL, labelMidY, -NODE_RADIUS - 2, commitRelY || 0, color, true));
  };

  GitGraph.prototype._buildHeadContent = function (g, isDetached, color, commitRelX, commitRelY) {
    var PTR_DEPTH = LABEL_HEIGHT / 2;
    var headTextW = 4 * 8.5 + 18;
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
      'font-size': 13, 'font-weight': 700,
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
        var ep = this._edgeEndpoint(cm, parent, commitMap);
        var x2 = ep.x;
        var y2 = ep.y;
        var color = cm.branchColor;
        var marker = ' marker-end="url(#' + this._arrowId + ')"';

        if (x1 === x2) {
          // Straight line (same column)
          svg += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" ' +
            'stroke="' + color + '" stroke-width="3" stroke-opacity="0.7"' + marker + '/>';
        } else {
          // Curved line (cross-column merge/branch)
          var midY = (y1 + y2) / 2;
          svg += '<path d="M ' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + midY + ', ' +
            x2 + ' ' + midY + ', ' + x2 + ' ' + y2 + '" ' +
            'fill="none" stroke="' + color + '" stroke-width="3" stroke-opacity="0.7"' + marker + '/>';
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
      var hashFont = shortName ? 18 : 11;
      var hashY    = shortName ? 7  : 5;
      var hashStr  = shortName ? cm.hash : cm.shortHash;
      svg += '<text x="' + cx + '" y="' + (cy + hashY) + '" text-anchor="middle" ' +
        'fill="#fff" font-size="' + hashFont + '" font-weight="700" class="git-graph-hash">' +
        this._escapeXml(hashStr) + '</text>';

      var msgX = cx + NODE_RADIUS + 24;
      svg += '<text x="' + msgX + '" y="' + (cy + 5) + '" ' +
        'fill="var(--git-graph-text, #ccc)" font-size="13" class="git-graph-message">' +
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
        var textW       = br.name.length * 8.5 + 18;
        var brW         = textW + PTR_DEPTH;
        var tipX        = cx - NODE_RADIUS - TIP_TO_NODE;
        var brX         = tipX - brW;
        var brD         = this._pointerPath(brX, labelY, brW, LABEL_HEIGHT);

        svg += '<path d="' + brD + '" fill="' + LABEL_BG + '" stroke="none"/>';
        svg += '<path d="' + brD + '" ' +
          'fill="' + color + '" fill-opacity="0.22" stroke="' + color + '" stroke-width="1.5"/>';
        svg += '<text x="' + (brX + textW / 2) + '" y="' + (labelMidY + 4) + '" ' +
          'text-anchor="middle" fill="' + color + '" font-size="13" font-weight="700" ' +
          'class="git-graph-branch-label">' + this._escapeXml(br.name) + '</text>';
        svg += lConnector(tipX, labelMidY, cx - NODE_RADIUS - 2, cy, color, true);

        if (isHeadBr) {
          var headTextW = 4 * 8.5 + 18;
          var headW     = headTextW + PTR_DEPTH;
          var headTipX  = brX - HEAD_GAP;
          var headX     = headTipX - headW;
          var headD     = this._pointerPath(headX, labelY, headW, LABEL_HEIGHT);

          svg += '<path d="' + headD + '" fill="' + LABEL_BG + '" stroke="none"/>';
          svg += '<path d="' + headD + '" ' +
            'fill="' + HEAD_COLOR + '" fill-opacity="0.95" stroke="' + color + '" stroke-width="1.5"/>';
          svg += '<text x="' + (headX + headTextW / 2) + '" y="' + (labelMidY + 4) + '" ' +
            'text-anchor="middle" fill="#1a1a1a" font-size="13" font-weight="700">HEAD</text>';
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
      var htextW     = 4 * 8.5 + 18;
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
        'text-anchor="middle" fill="' + DC + '" font-size="13" font-weight="700">HEAD</text>';
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

  GitGraph.prototype._escapeHtml = function (str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  // ---------------------------------------------------------------------------
  // Workbench — HTML panel above the graph that mimics `git status` output.
  // Renders three zones (Untracked / Not staged / Staged) plus an optional
  // stash shelf whenever the data has a non-empty workingTree. Kept in HTML
  // (not SVG) so the text flows, wraps, and renders natively in all themes.
  // ---------------------------------------------------------------------------

  var ZONE_HEADERS = {
    untracked: 'Untracked',
    unstaged:  'Not staged',
    staged:    'Staged',
  };
  var ZONE_HEADERS_FULL = {
    untracked: 'Untracked files',
    unstaged:  'Changes not staged for commit',
    staged:    'Changes to be committed',
  };

  // Render a static HTML string for the workbench. Empty string when the
  // data has no workingTree. Use for print rendering and the hidden "after"
  // SVG panel in the command-lab card.
  GitGraph.prototype.workbenchToHtml = function (data) {
    if (!data || !data.workingTree) return '';
    var wt = data.workingTree;
    var esc = this._escapeHtml.bind(this);

    function zoneHtml(name) {
      var items = wt[name] || [];
      var rowsHtml = '';
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var statusHtml = '';
        if (name !== 'untracked' && it.status) {
          statusHtml = '<span class="git-workbench-status">' + esc(it.status + ':') + '</span>';
        }
        rowsHtml += '<li class="git-workbench-row git-workbench-row--' + name + '" data-path="' + esc(it.path) + '">' +
          statusHtml +
          '<span class="git-workbench-path">' + esc(it.path) + '</span>' +
          '</li>';
      }
      var titleAttr = ' title="' + esc(ZONE_HEADERS_FULL[name] + ':') + '"';
      return '<section class="git-workbench-zone git-workbench-zone--' + name + '" data-zone="' + name + '">' +
        '<header class="git-workbench-zone-header"' + titleAttr + '>' + esc(ZONE_HEADERS[name]) + ':</header>' +
        '<ul class="git-workbench-rows">' + rowsHtml + '</ul>' +
        '</section>';
    }

    // Always include the strip when the spec declared `files`. Empty zones
    // remain visible so transitions like `git reset --hard` can show the
    // "all clean" endpoint explicitly.
    var stripHtml = '<div class="git-workbench-strip">' +
      zoneHtml('untracked') + zoneHtml('unstaged') + zoneHtml('staged') +
      '</div>';

    var shelfHtml = '';
    if (wt.stashed && wt.stashed.length) {
      var stashRows = '';
      for (var s = 0; s < wt.stashed.length; s++) {
        var st = wt.stashed[s];
        var label = st.ref + ': ' + (st.branch ? 'WIP on ' + st.branch + ': ' : '') + st.message;
        stashRows += '<li class="git-workbench-stash-entry" data-ref="' + esc(st.ref) + '">' +
          '<span class="git-workbench-path">' + esc(label) + '</span></li>';
      }
      shelfHtml = '<aside class="git-workbench-shelf" aria-label="Stash">' +
        '<header class="git-workbench-shelf-header">Stash</header>' +
        '<ul class="git-workbench-rows">' + stashRows + '</ul>' +
        '</aside>';
    }

    return '<div class="git-workbench">' + stripHtml + shelfHtml + '</div>';
  };

  // Static helper — like renderToSVG but for the workbench.
  GitGraph.renderWorkbench = function (data) {
    return new GitGraph(null).workbenchToHtml(data);
  };

  // Combined static helper: workbench HTML + graph SVG. Existing callers of
  // renderToSVG already set innerHTML with the result, so appending the
  // workbench prefix is transparent.
  GitGraph.renderStateMarkup = function (data) {
    var g = new GitGraph(null);
    return g.workbenchToHtml(data) + g.toSVG(data);
  };

  // ---- Live diff rendering for the workbench --------------------------------
  //
  // FLIP technique: record each row's bounding box before mutation, apply the
  // DOM changes (re-parent rows to their new zones, remove/insert rows), then
  // translate each surviving row from its old position back to its new one
  // and transition transform to zero. CSS handles status-color fade.

  GitGraph.prototype._ensureWorkbench = function (data) {
    if (!this.container) return null;
    if (!data || !data.workingTree) {
      if (this._workbenchEl && this._workbenchEl.parentNode) {
        this._workbenchEl.parentNode.removeChild(this._workbenchEl);
      }
      this._workbenchEl = null;
      this._workbenchRowEls = {};
      return null;
    }
    // If the workbench was orphaned (e.g. by an innerHTML wipe in the empty-
    // commits branch of render()), the stale reference is useless — rows
    // appended to it would be invisible, and their cached positions from
    // the previous render are no longer trustworthy. Create a fresh one
    // and reset the row cache so the next diff is a clean first render.
    var orphaned = this._workbenchEl &&
      (!this._workbenchEl.parentNode || this._workbenchEl.parentNode !== this.container);
    if (!this._workbenchEl || orphaned) {
      var wb = document.createElement('div');
      wb.className = 'git-workbench';
      // Place the workbench as the FIRST child of the container so it sits
      // above the SVG regardless of DOM build order (buildInitialSvg may
      // recreate the SVG but we want to keep the workbench attached).
      this.container.insertBefore(wb, this.container.firstChild);
      this._workbenchEl = wb;
      this._workbenchRowEls = {};
    }
    return this._workbenchEl;
  };

  GitGraph.prototype._diffWorkbench = function (data) {
    var wb = this._ensureWorkbench(data);
    if (!wb) {
      if (data && data.commits) {
        this._prevCommitHashes = {};
        for (var rc = 0; rc < data.commits.length; rc++) this._prevCommitHashes[data.commits[rc].hash] = true;
      }
      return;
    }
    var wt = data.workingTree;

    // Detect newly-added commit so staged rows about to be removed can fly
    // into the fresh commit node rather than just fading — matches the
    // "staged → committed" mental model visually.
    var newlyAddedCommit = null;
    var prev = this._prevCommitHashes || {};
    for (var nc = 0; nc < (data.commits || []).length; nc++) {
      if (!prev[data.commits[nc].hash]) {
        newlyAddedCommit = data.commits[nc];
        break;
      }
    }
    this._prevCommitHashes = {};
    for (var rc2 = 0; rc2 < (data.commits || []).length; rc2++) {
      this._prevCommitHashes[data.commits[rc2].hash] = true;
    }

    // Build the desired zone/shelf structure if missing. The strip is always
    // present as a stable target for row-moves even when empty mid-diff; the
    // CSS :not(:has(.git-workbench-row)) rule hides it visually when empty.
    if (!wb.querySelector('.git-workbench-strip')) {
      wb.innerHTML = '<div class="git-workbench-strip">' +
        '<section class="git-workbench-zone git-workbench-zone--untracked" data-zone="untracked">' +
          '<header class="git-workbench-zone-header" title="Untracked files:">Untracked:</header>' +
          '<ul class="git-workbench-rows"></ul>' +
        '</section>' +
        '<section class="git-workbench-zone git-workbench-zone--unstaged" data-zone="unstaged">' +
          '<header class="git-workbench-zone-header" title="Changes not staged for commit:">Not staged:</header>' +
          '<ul class="git-workbench-rows"></ul>' +
        '</section>' +
        '<section class="git-workbench-zone git-workbench-zone--staged" data-zone="staged">' +
          '<header class="git-workbench-zone-header" title="Changes to be committed:">Staged:</header>' +
          '<ul class="git-workbench-rows"></ul>' +
        '</section>' +
      '</div>';
    }

    // Step 1: record current row positions for FLIP. If the row has a zero
    // rect (parent was display:none — e.g. the tutorial's graph panel was
    // hidden until the user switched views), skip it so the FLIP later
    // doesn't compute a bogus delta from (0,0) to the row's real position,
    // which would make the animation "fly in from the top-left corner".
    var oldRects = {};
    var rowEls = this._workbenchRowEls || {};
    for (var key in rowEls) {
      if (rowEls.hasOwnProperty(key) && rowEls[key].el && rowEls[key].el.parentNode) {
        var r = rowEls[key].el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        oldRects[key] = { left: r.left, top: r.top };
      }
    }

    // Step 2: compute desired rows per zone, keyed by path (for files) or ref (for stash).
    var desired = {
      untracked: wt.untracked.map(function (f) { return { key: 'untracked:' + f.path, zone: 'untracked', data: f }; }),
      unstaged:  wt.unstaged.map(function (f) {  return { key: 'unstaged:' + f.path,  zone: 'unstaged',  data: f }; }),
      staged:    wt.staged.map(function (f) {    return { key: 'staged:' + f.path,    zone: 'staged',    data: f }; }),
      stashed:   wt.stashed.map(function (st) {  return { key: 'stashed:' + st.ref,   zone: 'stashed',   data: st }; }),
    };

    // Path-based tracking so a row that moves zones (e.g. foo.js: unstaged → staged)
    // reuses its DOM element — animating the slide via FLIP.
    var byPath = {};
    for (var p in rowEls) {
      if (!rowEls.hasOwnProperty(p)) continue;
      var pth = rowEls[p].path;
      if (!pth) continue;
      if (!byPath[pth]) byPath[pth] = [];
      byPath[pth].push({ key: p, entry: rowEls[p] });
    }

    // Step 3: reconcile. Build a map of surviving keys.
    var newRowEls = {};
    var zones = ['untracked', 'unstaged', 'staged', 'stashed'];
    var self = this;

    function ensureZoneContainer(zoneName) {
      if (zoneName === 'stashed') {
        var shelf = wb.querySelector('.git-workbench-shelf');
        if (!shelf) {
          shelf = document.createElement('aside');
          shelf.className = 'git-workbench-shelf';
          shelf.setAttribute('aria-label', 'Stash');
          shelf.innerHTML = '<header class="git-workbench-shelf-header">Stash</header><ul class="git-workbench-rows"></ul>';
          wb.appendChild(shelf);
        }
        return shelf.querySelector('.git-workbench-rows');
      }
      return wb.querySelector('.git-workbench-zone--' + zoneName + ' .git-workbench-rows');
    }

    for (var zi = 0; zi < zones.length; zi++) {
      var zoneName = zones[zi];
      var zoneList = desired[zoneName];
      var zoneContainer = ensureZoneContainer(zoneName);
      if (!zoneContainer) continue;
      for (var i = 0; i < zoneList.length; i++) {
        var d = zoneList[i];
        var reusedEntry = null;

        // Try to reuse by exact key (same path, same zone → update in place).
        if (rowEls[d.key]) {
          reusedEntry = rowEls[d.key];
          delete rowEls[d.key];
        } else if (zoneName !== 'stashed') {
          // Try to reuse by path from another zone → animate zone change.
          var path = d.data.path;
          if (byPath[path]) {
            // Pick the first remaining entry for this path that hasn't been reused.
            for (var bi = 0; bi < byPath[path].length; bi++) {
              var cand = byPath[path][bi];
              if (cand.entry._claimed) continue;
              if (cand.entry.zone === 'stashed') continue; // don't merge stash↔file
              reusedEntry = cand.entry;
              cand.entry._claimed = true;
              delete rowEls[cand.key];
              break;
            }
          }
        }

        if (reusedEntry) {
          // Capture the entry's pre-update zone + status so the FLIP step
          // later knows whether the row "actually changed" (zone swap or
          // status change) vs. merely shifted because siblings were
          // added/removed above it. Unchanged rows must not animate.
          reusedEntry._prevZone = reusedEntry.zone;
          reusedEntry._prevStatus = reusedEntry.status;
          reusedEntry._isFresh = false;
          self._updateWorkbenchRow(reusedEntry, d);
          newRowEls[d.key] = reusedEntry;
          if (reusedEntry.el.parentNode !== zoneContainer) {
            zoneContainer.appendChild(reusedEntry.el);
          } else {
            // Keep order consistent with desired list.
            zoneContainer.appendChild(reusedEntry.el);
          }
        } else {
          var fresh = self._createWorkbenchRow(d);
          fresh._isFresh = true;
          zoneContainer.appendChild(fresh.el);
          newRowEls[d.key] = fresh;
        }
      }
    }

    // Step 4: anything left in rowEls is departing. If a fresh commit just
    // appeared, any departing file row (staged OR unstaged — the latter
    // covers `git commit -am` which auto-stages tracked modifications) flies
    // into the new commit node. Untracked leavers still fade (they would
    // only disappear via explicit delete, not a commit). Stash entries are
    // also excluded — they go back into the strip via different paths.
    for (var leftoverKey in rowEls) {
      if (!rowEls.hasOwnProperty(leftoverKey)) continue;
      var leaver = rowEls[leftoverKey];
      var isFileRow = (leaver.zone === 'staged' || leaver.zone === 'unstaged');
      if (newlyAddedCommit && isFileRow) {
        self._flyRowIntoCommit(leaver, newlyAddedCommit);
      } else {
        self._removeWorkbenchRow(leaver);
      }
    }

    this._workbenchRowEls = newRowEls;

    // Step 5: FLIP animation — ONLY for rows that actually changed (zone
    // swap or status change). Rows whose zone + status stayed the same are
    // left alone even if their absolute position shifted because siblings
    // were added/removed above them; they snap to their new layout spot
    // without a glow or slide. This matches the user expectation that a
    // quiet row stays quiet.
    for (var surviveKey in newRowEls) {
      if (!newRowEls.hasOwnProperty(surviveKey)) continue;
      (function (entry) {
        entry._claimed = false;
        // Fresh rows already have the .entering animation from
        // _createWorkbenchRow — don't also FLIP them.
        if (entry._isFresh) return;
        // Reused rows that didn't change zone or status: skip animation.
        var zoneChanged = entry._prevZone !== undefined && entry._prevZone !== entry.zone;
        var statusChanged = entry._prevStatus !== undefined && entry._prevStatus !== entry.status;
        if (!zoneChanged && !statusChanged) return;
        var prior = oldRects[surviveKey];
        if (!prior) {
          for (var okey in oldRects) {
            if (oldRects.hasOwnProperty(okey) && okey.split(':').slice(1).join(':') === entry.path) {
              prior = oldRects[okey];
              break;
            }
          }
        }
        if (!prior) return;
        var newRect = entry.el.getBoundingClientRect();
        var dx = prior.left - newRect.left;
        var dy = prior.top - newRect.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
          // Status changed but position didn't (rare) — fire a burst without
          // the slide so the change is still perceptible.
          entry.el.classList.add('git-workbench-row-burst');
          setTimeout(function () { entry.el.classList.remove('git-workbench-row-burst'); }, 800);
          return;
        }
        var el = entry.el;
        // Yellow-burst flash to signal the zone change, matching the
        // git-graph's own commit-burst vocabulary.
        // Cancel any in-flight cleanup from a previous FLIP so the next
        // scheduled removal doesn't yank --fx/--fy out mid-animation of this
        // new transition — that would collapse the keyframe's `from` to the
        // fallback 0 and make the animation start at the new position.
        if (el._flipBurstTimer) clearTimeout(el._flipBurstTimer);
        if (el._flipCleanupTimer) clearTimeout(el._flipCleanupTimer);
        el.classList.add('git-workbench-row-burst');
        el._flipBurstTimer = setTimeout(function () {
          el.classList.remove('git-workbench-row-burst');
          el._flipBurstTimer = null;
        }, 800);
        // Feed dx/dy to the CSS keyframe via custom properties, then toggle
        // the .git-workbench-row-flip class to (re)trigger the animation.
        el.style.setProperty('--fx', dx + 'px');
        el.style.setProperty('--fy', dy + 'px');
        el.classList.remove('git-workbench-row-flip');
        // Force a reflow so the class-remove commits before re-adding, so
        // the animation restarts even if it was already running from a
        // previous transition.
        /* eslint-disable no-unused-expressions */
        el.offsetWidth;
        /* eslint-enable no-unused-expressions */
        el.classList.add('git-workbench-row-flip');
        el._flipCleanupTimer = setTimeout(function () {
          el.classList.remove('git-workbench-row-flip');
          el.style.removeProperty('--fx');
          el.style.removeProperty('--fy');
          el._flipCleanupTimer = null;
        }, 760);
      })(newRowEls[surviveKey]);
    }

    // Remove stash shelf entirely if empty, matching the spec.
    var shelf = wb.querySelector('.git-workbench-shelf');
    if (shelf) {
      var shelfRows = shelf.querySelectorAll('.git-workbench-stash-entry');
      if (shelfRows.length === 0) {
        shelf.parentNode.removeChild(shelf);
      }
    }
  };

  GitGraph.prototype._createWorkbenchRow = function (d) {
    var li = document.createElement('li');
    li.className = 'git-workbench-row git-workbench-row--' + d.zone + ' entering';
    var path, label;
    if (d.zone === 'stashed') {
      path = d.data.ref;
      label = d.data.ref + ': ' + (d.data.branch ? 'WIP on ' + d.data.branch + ': ' : '') + d.data.message;
      li.className = 'git-workbench-stash-entry entering';
      li.setAttribute('data-ref', d.data.ref);
      li.innerHTML = '<span class="git-workbench-path">' + this._escapeHtml(label) + '</span>';
    } else {
      path = d.data.path;
      li.setAttribute('data-path', path);
      var statusHtml = '';
      if (d.zone !== 'untracked' && d.data.status) {
        statusHtml = '<span class="git-workbench-status">' + this._escapeHtml(d.data.status + ':') + '</span>';
      }
      li.innerHTML = statusHtml + '<span class="git-workbench-path">' + this._escapeHtml(path) + '</span>';
    }
    setTimeout(function () { li.classList.remove('entering'); }, 480);
    return {
      el: li, zone: d.zone, path: path,
      status: d.data.status, message: d.data.message,
    };
  };

  GitGraph.prototype._updateWorkbenchRow = function (entry, d) {
    var el = entry.el;
    var newZoneClass = 'git-workbench-row--' + d.zone;
    if (d.zone !== 'stashed') {
      // Normalize class list — strip old zone modifier and stash class.
      el.className = 'git-workbench-row ' + newZoneClass;
      var statusSpan = el.querySelector('.git-workbench-status');
      if (d.zone === 'untracked' || !d.data.status) {
        if (statusSpan) statusSpan.parentNode.removeChild(statusSpan);
      } else {
        if (!statusSpan) {
          statusSpan = document.createElement('span');
          statusSpan.className = 'git-workbench-status';
          el.insertBefore(statusSpan, el.firstChild);
        }
        statusSpan.textContent = d.data.status + ':';
      }
      var pathSpan = el.querySelector('.git-workbench-path');
      if (pathSpan && pathSpan.textContent !== d.data.path) pathSpan.textContent = d.data.path;
      entry.path = d.data.path;
      entry.status = d.data.status;
    } else {
      el.className = 'git-workbench-stash-entry';
      var label = d.data.ref + ': ' + (d.data.branch ? 'WIP on ' + d.data.branch + ': ' : '') + d.data.message;
      var pathSpanS = el.querySelector('.git-workbench-path');
      if (pathSpanS) pathSpanS.textContent = label;
      entry.path = d.data.ref;
      entry.message = d.data.message;
    }
    entry.zone = d.zone;
    return entry;
  };

  GitGraph.prototype._removeWorkbenchRow = function (entry) {
    var el = entry.el;
    el.classList.add('exiting');
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 400);
  };

  // Animate a staged or unstaged row flying into a freshly-created commit
  // node so the "tree → committed" transition reads as one continuous motion
  // with the commit-burst flash. Uses CSS custom properties fed into the
  // `git-workbench-row-fly` keyframe so the yellow-gold burst fires in sync
  // with the translate+shrink — same vocabulary as the FLIP zone-change.
  GitGraph.prototype._flyRowIntoCommit = function (entry, commit) {
    var rowEl = entry.el;
    var nodeEntry = this._nodeEls && this._nodeEls[commit.hash];
    if (!nodeEntry || !nodeEntry.g || !rowEl.parentNode) {
      this._removeWorkbenchRow(entry);
      return;
    }
    var rowRect = rowEl.getBoundingClientRect();
    var nodeRect = nodeEntry.g.getBoundingClientRect();
    if (!rowRect.width || !nodeRect.width) {
      this._removeWorkbenchRow(entry);
      return;
    }
    var dx = (nodeRect.left + nodeRect.width / 2) - (rowRect.left + rowRect.width / 2);
    var dy = (nodeRect.top + nodeRect.height / 2) - (rowRect.top + rowRect.height / 2);
    rowEl.style.transformOrigin = 'center center';
    rowEl.style.pointerEvents = 'none';
    rowEl.style.zIndex = '5';
    rowEl.style.setProperty('--fx', dx + 'px');
    rowEl.style.setProperty('--fy', dy + 'px');
    // Force reflow so adding the class (re)triggers the animation.
    /* eslint-disable no-unused-expressions */
    rowEl.offsetWidth;
    /* eslint-enable no-unused-expressions */
    rowEl.classList.add('git-workbench-row-fly');
    setTimeout(function () {
      if (rowEl.parentNode) rowEl.parentNode.removeChild(rowEl);
    }, 500);
  };

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  window.GitGraph = GitGraph;
})();
