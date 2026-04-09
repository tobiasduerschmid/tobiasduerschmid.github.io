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
  var PADDING_LEFT = 250;  // extra space for branch labels + HEAD pointer on the left
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
  GitGraph.prototype.render = function (data) {
    this._data = data;
    if (!data || data.commits.length === 0) {
      // Only show the empty placeholder if the container has no prior graph.
      // This avoids flashing "No commits yet" when a full refresh is pending.
      if (!this.container.querySelector('.git-graph-svg')) {
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

    var commits = data.commits;
    var branches = data.branches;
    var head = data.head;

    var width = PADDING_LEFT + (this._colCount) * COL_WIDTH + (this._rightLabelSpace || 0) + 480; // 480px ≈ 50 chars × 8px + buffer for commit messages
    var height = PADDING_TOP + commits.length * ROW_HEIGHT + PADDING_BOTTOM;

    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" ' +
      'class="git-graph-svg" style="font-family:\'Fira Code\',\'Cascadia Code\',Menlo,monospace;">';

    // Draw edges first (behind nodes)
    svg += this._renderEdges(commits, data.commitMap);

    // Draw commit nodes
    svg += this._renderNodes(commits, head);

    // Draw branch labels
    svg += this._renderBranchLabels(branches, data.commitMap, head);

    svg += '</svg>';
    this.container.innerHTML = svg;
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

      // Short hash text inside node
      svg += '<text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" ' +
        'fill="#fff" font-size="10" font-weight="600" class="git-graph-hash">' +
        cm.shortHash + '</text>';

      // Commit message — pushed right to clear any right-side branch labels
      var msgX = this._cx(this._colCount) + (this._rightLabelSpace || 0) + 20;
      svg += '<text x="' + msgX + '" y="' + (cy + 4) + '" ' +
        'fill="var(--git-graph-text, #ccc)" font-size="12" class="git-graph-message">' +
        this._escapeXml(this._truncate(cm.message, 50)) + '</text>';
    }
    return svg;
  };

  GitGraph.prototype._renderBranchLabels = function (branches, commitMap, head) {
    var self = this;
    var svg = '';

    // Geometry constants
    var PTR_DEPTH           = LABEL_HEIGHT / 2;   // 12 px — triangular tip depth
    var TIP_TO_NODE         = 10;                 // gap: pointer tip → node circle edge
    var HEAD_GAP            = 4;                  // gap between HEAD label and branch label
    var HEAD_COLOR          = '#ffffff';
    var HEAD_DETACHED_COLOR = '#f39c12';

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

      // Commits on col > 0 would have their left-side label cross the edges of
      // the columns to their left — flip those labels to the right side instead.
      var flipRight = (commit.col > 0);

      for (var l = 0; l < labels.length; l++) {
        var br          = labels[l];
        var isHeadBr    = (!head.detached && head.ref === br.name);
        var color       = this._branchColors[br.name] || BRANCH_COLORS[0];
        var labelY      = cy - LABEL_HEIGHT / 2 - (labels.length - 1 - l) * (LABEL_HEIGHT + LABEL_GAP);
        var labelMidY   = labelY + LABEL_HEIGHT / 2;
        var textW       = br.name.length * 7.5 + 16;
        var brW         = textW + PTR_DEPTH;

        if (flipRight) {
          // ── RIGHT side: left-pointing pointer ◀, label extends rightward ──
          var tipX  = cx + NODE_RADIUS + TIP_TO_NODE;   // tip touches node right side
          var brX   = tipX;                              // left bounding edge = tip

          svg += '<path d="' + this._pointerPath(brX, labelY, brW, LABEL_HEIGHT, 'left') + '" ' +
            'fill="' + color + '" fill-opacity="0.22" stroke="' + color + '" stroke-width="1.5"/>';
          svg += '<text x="' + (brX + PTR_DEPTH + textW / 2) + '" y="' + (labelMidY + 4) + '" ' +
            'text-anchor="middle" fill="' + color + '" font-size="11" font-weight="700" ' +
            'class="git-graph-branch-label">' + this._escapeXml(br.name) + '</text>';

          // Connector: vert from node centre to label row, then horiz to tip
          svg += lConnector(cx + NODE_RADIUS + 2, cy, tipX, labelMidY, color, false);

          if (isHeadBr) {
            var headTextW = 4 * 7.5 + 16;
            var headW     = headTextW + PTR_DEPTH;
            var headX     = brX + brW + HEAD_GAP;   // HEAD sits to the right of branch label

            svg += '<path d="' + this._pointerPath(headX, labelY, headW, LABEL_HEIGHT, 'left') + '" ' +
              'fill="' + HEAD_COLOR + '" fill-opacity="0.95" stroke="' + color + '" stroke-width="1.5"/>';
            svg += '<text x="' + (headX + PTR_DEPTH + headTextW / 2) + '" y="' + (labelMidY + 4) + '" ' +
              'text-anchor="middle" fill="#1a1a1a" font-size="11" font-weight="700">HEAD</text>';
            // Short solid connector: branch right edge → HEAD tip
            svg += '<line x1="' + (brX + brW) + '" y1="' + labelMidY + '" ' +
              'x2="' + headX + '" y2="' + labelMidY + '" stroke="' + color + '" stroke-width="1.5"/>';
          }

        } else {
          // ── LEFT side: right-pointing pointer ▶, label extends leftward ──
          var tipX  = cx - NODE_RADIUS - TIP_TO_NODE;
          var brX   = tipX - brW;

          svg += '<path d="' + this._pointerPath(brX, labelY, brW, LABEL_HEIGHT) + '" ' +
            'fill="' + color + '" fill-opacity="0.22" stroke="' + color + '" stroke-width="1.5"/>';
          svg += '<text x="' + (brX + textW / 2) + '" y="' + (labelMidY + 4) + '" ' +
            'text-anchor="middle" fill="' + color + '" font-size="11" font-weight="700" ' +
            'class="git-graph-branch-label">' + this._escapeXml(br.name) + '</text>';

          // Connector: horiz from tip then vert to node centre
          svg += lConnector(tipX, labelMidY, cx - NODE_RADIUS - 2, cy, color, true);

          if (isHeadBr) {
            var headTextW = 4 * 7.5 + 16;
            var headW     = headTextW + PTR_DEPTH;
            var headTipX  = brX - HEAD_GAP;
            var headX     = headTipX - headW;

            svg += '<path d="' + this._pointerPath(headX, labelY, headW, LABEL_HEIGHT) + '" ' +
              'fill="' + HEAD_COLOR + '" fill-opacity="0.95" stroke="' + color + '" stroke-width="1.5"/>';
            svg += '<text x="' + (headX + headTextW / 2) + '" y="' + (labelMidY + 4) + '" ' +
              'text-anchor="middle" fill="#1a1a1a" font-size="11" font-weight="700">HEAD</text>';
            svg += '<line x1="' + headTipX + '" y1="' + labelMidY + '" ' +
              'x2="' + brX + '" y2="' + labelMidY + '" stroke="' + color + '" stroke-width="1.5"/>';
          }
        }
      }
    }

    // ── Detached HEAD ─────────────────────────────────────────────────────────
    if (head.detached && head.hash && commitMap[head.hash]) {
      var hCommit    = commitMap[head.hash];
      var hcx        = this._cx(hCommit.col);
      var hcy        = this._cy(hCommit.row);
      var DC         = HEAD_DETACHED_COLOR;
      var hFlip      = (hCommit.col > 0);
      var htextW     = 4 * 7.5 + 16;
      var hW         = htextW + PTR_DEPTH;
      var hlabelY    = hcy - LABEL_HEIGHT / 2;
      var hlabelMidY = hcy;

      if (labelsByCommit[head.hash]) {
        hlabelY    += labelsByCommit[head.hash].length * (LABEL_HEIGHT + LABEL_GAP);
        hlabelMidY  = hlabelY + LABEL_HEIGHT / 2;
      }

      if (hFlip) {
        var htipX = hcx + NODE_RADIUS + TIP_TO_NODE;
        svg += '<path d="' + this._pointerPath(htipX, hlabelY, hW, LABEL_HEIGHT, 'left') + '" ' +
          'fill="' + DC + '" fill-opacity="0.25" stroke="' + DC + '" stroke-width="1.5"/>';
        svg += '<text x="' + (htipX + PTR_DEPTH + htextW / 2) + '" y="' + (hlabelMidY + 4) + '" ' +
          'text-anchor="middle" fill="' + DC + '" font-size="11" font-weight="700">HEAD</text>';
        svg += lConnector(hcx + NODE_RADIUS + 2, hcy, htipX, hlabelMidY, DC, false);
      } else {
        var htipX = hcx - NODE_RADIUS - TIP_TO_NODE;
        var hX    = htipX - hW;
        svg += '<path d="' + this._pointerPath(hX, hlabelY, hW, LABEL_HEIGHT) + '" ' +
          'fill="' + DC + '" fill-opacity="0.25" stroke="' + DC + '" stroke-width="1.5"/>';
        svg += '<text x="' + (hX + htextW / 2) + '" y="' + (hlabelMidY + 4) + '" ' +
          'text-anchor="middle" fill="' + DC + '" font-size="11" font-weight="700">HEAD</text>';
        svg += lConnector(htipX, hlabelMidY, hcx - NODE_RADIUS - 2, hcy, DC, true);
      }
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
