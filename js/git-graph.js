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

  // Branch color palette — consistent hashing by branch name
  var BRANCH_COLORS = [
    '#e74c3c', // red
    '#2ecc71', // green
    '#3498db', // blue
    '#f39c12', // orange
    '#9b59b6', // purple
    '#1abc9c', // teal
    '#e67e22', // dark orange
    '#e84393', // pink
  ];

  // Layout constants
  var NODE_RADIUS = 16;
  var ROW_HEIGHT = 70;
  var COL_WIDTH = 70;
  var PADDING_TOP = 50;
  var PADDING_LEFT = 180;  // extra space for branch labels on the left
  var PADDING_BOTTOM = 40;
  var LABEL_OFFSET_X = 28;
  var LABEL_HEIGHT = 22;
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
        shortHash: hash.substring(0, 7),
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
    // Ensure 'main' and 'master' get green
    if (branchColors['main']) branchColors['main'] = BRANCH_COLORS[1];
    if (branchColors['master']) branchColors['master'] = BRANCH_COLORS[1];

    // Assign each commit to a branch (for coloring)
    var commitBranch = {};
    // First pass: commits that are branch tips
    for (var bt = 0; bt < branches.length; bt++) {
      commitBranch[branches[bt].hash] = branches[bt].name;
    }
    // Walk backwards to assign branch membership via first-parent chain
    for (var ci = 0; ci < commits.length; ci++) {
      var cm = commits[ci];
      if (!commitBranch[cm.hash] && cm.parents.length > 0) {
        // Check if any child already has a branch assigned
        for (var ch = 0; ch < cm.children.length; ch++) {
          if (commitBranch[cm.children[ch]]) {
            // If this commit is the first parent of that child, inherit branch
            var childCommit = commitMap[cm.children[ch]];
            if (childCommit && childCommit.parents[0] === cm.hash) {
              commitBranch[cm.hash] = commitBranch[cm.children[ch]];
              break;
            }
          }
        }
      }
      // Default to 'main' or 'master' or first branch
      if (!commitBranch[cm.hash]) {
        commitBranch[cm.hash] = branches.length > 0 ? branches[0].name : 'main';
      }
    }

    // Assign columns by branch — each unique branch gets its own column
    var branchCols = {};
    var colCount = 0;
    // main/master always in column 0
    var mainBranch = branchColors['main'] ? 'main' : (branchColors['master'] ? 'master' : null);
    if (mainBranch) {
      branchCols[mainBranch] = 0;
      colCount = 1;
    }
    for (var bc = 0; bc < branches.length; bc++) {
      var bn = branches[bc].name;
      if (branchCols[bn] === undefined) {
        branchCols[bn] = colCount++;
      }
    }

    // Commits are in topo order (newest first) — assign rows top-to-bottom
    for (var r = 0; r < commits.length; r++) {
      var commit = commits[r];
      var branch = commitBranch[commit.hash];
      commit.col = branchCols[branch] !== undefined ? branchCols[branch] : 0;
      commit.row = r;
      commit.branchColor = branchColors[branch] || BRANCH_COLORS[0];
      commit.branchName = branch;
    }

    this._branchColors = branchColors;
    this._commitBranch = commitBranch;
    this._branchCols = branchCols;
    this._colCount = colCount;
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
      this.container.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;' +
        'color:#888;font-family:system-ui;font-size:14px;">' +
        '<div style="text-align:center">' +
        '<div style="font-size:48px;margin-bottom:12px;">&#x1f333;</div>' +
        '<div>No commits yet.<br>Run <code style="background:#2a2a3a;padding:2px 6px;border-radius:4px;">git commit</code> to see the graph.</div>' +
        '</div></div>';
      return;
    }

    this._layout(data);

    var commits = data.commits;
    var branches = data.branches;
    var head = data.head;

    var width = PADDING_LEFT + (this._colCount) * COL_WIDTH + 200; // extra for labels
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
        'fill="#fff" font-size="9" font-weight="600" class="git-graph-hash">' +
        cm.shortHash + '</text>';

      // Commit message to the right of the rightmost column
      var msgX = this._cx(this._colCount) + 20;
      svg += '<text x="' + msgX + '" y="' + (cy + 4) + '" ' +
        'fill="var(--git-graph-text, #ccc)" font-size="12" class="git-graph-message">' +
        this._escapeXml(this._truncate(cm.message, 50)) + '</text>';
    }
    return svg;
  };

  GitGraph.prototype._renderBranchLabels = function (branches, commitMap, head) {
    var svg = '';
    // Group labels by commit hash to stack them
    var labelsByCommit = {};
    for (var i = 0; i < branches.length; i++) {
      var br = branches[i];
      var commit = commitMap[br.hash];
      if (!commit) continue;
      if (!labelsByCommit[br.hash]) labelsByCommit[br.hash] = [];
      labelsByCommit[br.hash].push(br);
    }

    for (var hash in labelsByCommit) {
      if (!labelsByCommit.hasOwnProperty(hash)) continue;
      var labels = labelsByCommit[hash];
      var commit = commitMap[hash];
      var cx = this._cx(commit.col);
      var cy = this._cy(commit.row);

      for (var l = 0; l < labels.length; l++) {
        var br = labels[l];
        var isHead = (head.ref === br.name);
        var color = this._branchColors[br.name] || BRANCH_COLORS[0];
        var labelX = cx - LABEL_OFFSET_X - 4;
        var labelY = cy - LABEL_HEIGHT / 2 - (labels.length - 1 - l) * (LABEL_HEIGHT + LABEL_GAP);

        var textLen = br.name.length * 7.5 + 16;
        if (isHead) textLen += 28; // extra space for HEAD prefix

        // Label pill (to the left of the node)
        var pillX = labelX - textLen;
        svg += '<rect x="' + pillX + '" y="' + labelY + '" ' +
          'width="' + textLen + '" height="' + LABEL_HEIGHT + '" rx="4" ry="4" ' +
          'fill="' + color + '" fill-opacity="0.2" stroke="' + color + '" stroke-width="1.5"/>';

        // Branch name text
        var textX = pillX + 8;
        svg += '<text x="' + textX + '" y="' + (labelY + LABEL_HEIGHT / 2 + 4) + '" ' +
          'fill="' + color + '" font-size="11" font-weight="700" class="git-graph-branch-label">';
        if (isHead) {
          svg += 'HEAD\u2192 ';
        }
        svg += this._escapeXml(br.name);
        svg += '</text>';

        // Arrow from pill to node
        svg += '<line x1="' + labelX + '" y1="' + (labelY + LABEL_HEIGHT / 2) + '" ' +
          'x2="' + (cx - NODE_RADIUS - 2) + '" y2="' + cy + '" ' +
          'stroke="' + color + '" stroke-width="1.5" stroke-opacity="0.5" ' +
          'stroke-dasharray="3,2"/>';
      }
    }

    // Render detached HEAD label if needed
    if (head.detached && head.hash && commitMap[head.hash]) {
      var hCommit = commitMap[head.hash];
      var hcx = this._cx(hCommit.col);
      var hcy = this._cy(hCommit.row);
      var hlabelX = hcx - LABEL_OFFSET_X - 4;
      var htextLen = 100;
      var hpillX = hlabelX - htextLen;
      var hlabelY = hcy - LABEL_HEIGHT / 2;

      // Check if there are already branch labels on this commit — offset below
      if (labelsByCommit[head.hash]) {
        hlabelY += (labelsByCommit[head.hash].length) * (LABEL_HEIGHT + LABEL_GAP);
      }

      svg += '<rect x="' + hpillX + '" y="' + hlabelY + '" ' +
        'width="' + htextLen + '" height="' + LABEL_HEIGHT + '" rx="4" ry="4" ' +
        'fill="#f39c12" fill-opacity="0.2" stroke="#f39c12" stroke-width="1.5"/>';
      svg += '<text x="' + (hpillX + 8) + '" y="' + (hlabelY + LABEL_HEIGHT / 2 + 4) + '" ' +
        'fill="#f39c12" font-size="11" font-weight="700">HEAD (detached)</text>';
      svg += '<line x1="' + hlabelX + '" y1="' + (hlabelY + LABEL_HEIGHT / 2) + '" ' +
        'x2="' + (hcx - NODE_RADIUS - 2) + '" y2="' + hcy + '" ' +
        'stroke="#f39c12" stroke-width="1.5" stroke-opacity="0.5" stroke-dasharray="3,2"/>';
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
