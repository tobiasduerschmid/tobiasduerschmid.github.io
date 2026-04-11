/**
 * Advanced Algorithmic Foundations for UML Visualization
 * Layout Engine utilizing Sugiyama Framework, Barycenter Heuristics,
 * and Orthogonal Edge Routing with Overlap Removal.
 */
(function() {
  'use strict';

  var LayoutEngine = {};

  /**
   * Main entry point for advanced layout.
   * @param {Array} nodes - [{ id: 'A', width: 100, height: 50, data: {} }]
   * @param {Array} edges - [{ source: 'A', target: 'B', type: 'generalization', weight: 1, data: {} }]
   * @param {Object} options - { gapX, gapY, useOrthogonal }
   * @returns {Object} { nodes: { id: {x, y, width, height, data} }, edges: [ { points: [{x,y}], data } ] }
   */
  LayoutEngine.compute = function(nodes, edges, options) {
    var gapX = options.gapX || 60;
    var gapY = options.gapY || 80;

    // 1. Build Adjacency & Find Components
    var adj = {}, inDegree = {}, outDegree = {};
    var nodeMap = {};
    nodes.forEach(function(n) {
      adj[n.id] = [];
      inDegree[n.id] = 0;
      outDegree[n.id] = 0;
      nodeMap[n.id] = n;
    });

    // Determine direction based on edge type
    var directedEdges = [];
    edges.forEach(function(e) {
      if (!nodeMap[e.source] || !nodeMap[e.target]) return;
      var src = e.source, tgt = e.target;

      // Inheritance: target is upper, source is lower
      if (e.type === 'generalization' || e.type === 'realization') {
        src = e.target; tgt = e.source;
      } else if (e.type === 'composition' || e.type === 'aggregation') { // owner upper, owned lower
        src = e.source; tgt = e.target;
      } else if (e.type === 'dependency' || e.type === 'navigable') {
        src = e.source; tgt = e.target;
      }

      if (src === tgt) return;
      
      // Directed edge
      adj[src].push(tgt);
      inDegree[tgt]++;
      outDegree[src]++;
      
      directedEdges.push({ orig: e, src: src, tgt: tgt });
    });

    // 2. Cycle Removal (DFS)
    var visited = {}, recStack = {};
    function dfs(u) {
      visited[u] = true;
      recStack[u] = true;
      var newAdj = [];
      for (var i = 0; i < adj[u].length; i++) {
        var v = adj[u][i];
        if (!visited[v]) {
          dfs(v);
          newAdj.push(v);
        } else if (recStack[v]) {
          // cycle detected! Reverse the edge virtually
          adj[v].push(u);
          inDegree[u]++;
          inDegree[v]--;
        } else {
          newAdj.push(v);
        }
      }
      adj[u] = newAdj;
      recStack[u] = false;
    }
    nodes.forEach(function(n) { if (!visited[n.id]) dfs(n.id); });

    // 3. Layer Assignment (Longest Path)
    var layers = {};
    var roots = [];
    nodes.forEach(function(n) { if (inDegree[n.id] === 0) roots.push(n.id); });
    if (roots.length === 0 && nodes.length > 0) roots.push(nodes[0].id); // fallback
    
    var queue = [].concat(roots);
    roots.forEach(function(r) { layers[r] = 0; });
    while (queue.length > 0) {
      var u = queue.shift();
      adj[u].forEach(function(v) {
        var newLayer = (layers[u] || 0) + 1;
        if (layers[v] === undefined || newLayer > layers[v]) {
          layers[v] = newLayer;
          queue.push(v);
        }
      });
    }
    nodes.forEach(function(n) { if (layers[n.id] === undefined) layers[n.id] = 0; });

    // 4. Dummy Node Insertion
    var layerMax = 0;
    var layerGroups = [];
    nodes.forEach(function(n) {
      var l = layers[n.id];
      layerMax = Math.max(layerMax, l);
      if (!layerGroups[l]) layerGroups[l] = [];
      layerGroups[l].push(n.id);
    });

    var dummyNodes = {}; // id -> { layer, src, tgt, orig }
    var origEdgesMap = {}; // hash -> orig edge
    directedEdges.forEach(function(de) {
      var s = de.src, t = de.tgt;
      var sl = layers[s], tl = layers[t];
      origEdgesMap[s + '->' + t] = de.orig;
      
      if (tl - sl > 1) {
        var prev = s;
        for (var l = sl + 1; l < tl; l++) {
          var dummyId = '--dummy--' + s + '->' + t + '--' + l;
          dummyNodes[dummyId] = { id: dummyId, width: 2, height: 2, src: de.src, tgt: de.tgt, orig: de.orig };
          if (!layerGroups[l]) layerGroups[l] = [];
          layerGroups[l].push(dummyId);
          
          Object.defineProperty(dummyNodes, dummyId, { value: dummyNodes[dummyId], enumerable: true }); // make sure it's accessible
          
          adj[prev].push(dummyId);
          adj[dummyId] = [];
          
          // Remove old edge to t? Wait, adj only has end targets originally
          prev = dummyId;
        }
        adj[prev].push(t);
        
        // Remove s->t from adj[s]
        var idx = adj[s].indexOf(t);
        if (idx !== -1) adj[s].splice(idx, 1);
      }
    });

    // 5. Crossing Minimization (Barycenter)
    var pos = {};
    layerGroups.forEach(function(g, l) {
      if (!g) return;
      g.forEach(function(u, i) { pos[u] = i; });
    });

    for (var pass = 0; pass < 6; pass++) {
      if (pass % 2 === 0) { // Forward
        for (var l = 1; l <= layerMax; l++) {
          if (!layerGroups[l] || !layerGroups[l-1]) continue;
          var g = layerGroups[l];
          var bary = {};
          g.forEach(function(u) {
            var sum = 0, count = 0;
            // find predecessors in l-1
            layerGroups[l-1].forEach(function(v) {
              if (adj[v] && adj[v].indexOf(u) !== -1) {
                sum += pos[v]; count++;
              }
            });
            bary[u] = count > 0 ? sum / count : pos[u];
          });
          g.sort(function(a,b) { return bary[a] - bary[b]; });
          g.forEach(function(u, i) { pos[u] = i; });
        }
      } else { // Backward
        for (var l = layerMax - 1; l >= 0; l--) {
          if (!layerGroups[l] || !layerGroups[l+1]) continue;
          var g = layerGroups[l];
          var bary = {};
          g.forEach(function(u) {
            var sum = 0, count = 0;
            if (adj[u]) {
              adj[u].forEach(function(v) {
                if (pos[v] !== undefined) {
                  sum += pos[v]; count++;
                }
              });
            }
            bary[u] = count > 0 ? sum / count : pos[u];
          });
          g.sort(function(a,b) { return bary[a] - bary[b]; });
          g.forEach(function(u, i) { pos[u] = i; });
        }
      }
    }

    // 6. X-Coordinate Assignment (Simple packing)
    var coords = {}; // id -> {x, y, w, h}
    var currentY = 0;
    for (var l = 0; l <= layerMax; l++) {
      if (!layerGroups[l]) continue;
      var currentX = 0;
      var layerH = 0;
      layerGroups[l].forEach(function(u) {
        var w = nodeMap[u] ? nodeMap[u].width : 2;
        var h = nodeMap[u] ? nodeMap[u].height : 2;
        coords[u] = { x: currentX, y: currentY, w: w, h: h, cy: currentY + h/2 };
        currentX += w + gapX;
        layerH = Math.max(layerH, h);
      });
      
      // Center the layer based on the previous layer's center of mass to create nicer trees
      if (l > 0 && layerGroups[l-1]) {
        var idealX = 0, idealCount = 0;
        layerGroups[l].forEach(function(u) {
           layerGroups[l-1].forEach(function(v) {
             if (adj[v] && adj[v].indexOf(u) !== -1) {
               idealX += coords[v].x + coords[v].w/2;
               idealCount++;
             }
           });
        });
        if (idealCount > 0) {
          idealX /= idealCount;
          var layerCentX = (coords[layerGroups[l][0]].x + coords[layerGroups[l][layerGroups[l].length-1]].x + coords[layerGroups[l][layerGroups[l].length-1]].w) / 2;
          var shift = idealX - layerCentX;
          layerGroups[l].forEach(function(u) { coords[u].x += shift; });
        }
      }

      var cMaxY = currentY + layerH;
      layerGroups[l].forEach(function(u) {
         coords[u].y = currentY; // Top aligned
      });
      currentY = cMaxY + gapY;
    }

    // Ensure no overlapping horizontally if shifted (Overlap removal)
    for (var l = 0; l <= layerMax; l++) {
      if (!layerGroups[l]) continue;
      var g = layerGroups[l];
      for (var i = 1; i < g.length; i++) {
        var prev = coords[g[i-1]], cur = coords[g[i]];
        if (cur.x < prev.x + prev.w + gapX) {
          var shift = (prev.x + prev.w + gapX) - cur.x;
          for (var j = i; j < g.length; j++) {
            coords[g[j]].x += shift;
          }
        }
      }
    }

    // 7. Route Edges
    var resultNodes = {};
    var resultEdges = [];
    
    nodes.forEach(function(n) {
      resultNodes[n.id] = { x: coords[n.id].x, y: coords[n.id].y, width: coords[n.id].w, height: coords[n.id].h, data: n.data };
    });

    // Resolve dummy nodes into edge segments
    edges.forEach(function(e) {
      // Find route through dummies
      var route = [];
      var s = e.source, t = e.target;
      var actualS = s, actualT = t;
      var isReversed = false;
      
      // Directed edge resolution
      if (e.type === 'generalization' || e.type === 'realization') {
        actualS = e.target; actualT = e.source; isReversed = true;
      } else if (e.type === 'composition' || e.type === 'aggregation') {
        actualS = e.source; actualT = e.target;
      } else if (e.type === 'dependency' || e.type === 'navigable') {
        actualS = e.source; actualT = e.target; 
      }
      
      var c1 = coords[actualS], c2 = coords[actualT];
      if (!c1 || !c2) return;
      
      // Starting point at bottom of actualS
      var currentPos = actualS;
      route.push({ x: c1.x + c1.w/2, y: c1.y + c1.h });
      
      // Trace dummy nodes
      var sl = layers[actualS], tl = layers[actualT];
      if (tl - sl > 1) {
        for (var ll = sl + 1; ll < tl; ll++) {
           var dummyId = '--dummy--' + actualS + '->' + actualT + '--' + ll;
           var dCoord = coords[dummyId];
           if (dCoord) {
             route.push({ x: dCoord.x + 1, y: dCoord.y + 1 });
           }
        }
      }
      
      route.push({ x: c2.x + c2.w/2, y: c2.y });
      
      if (isReversed) {
        route.reverse(); // If reversed, the edge visibly goes from `s` to `t`, so we flip the points back.
      }
      
      // Orthogonalize
      var orthoRoute = [];
      for (var i = 0; i < route.length - 1; i++) {
        var p1 = route[i], p2 = route[i+1];
        orthoRoute.push({x: p1.x, y: p1.y});
        
        // Midpoint orthogonal bend
        if (p1.x !== p2.x && p1.y !== p2.y) {
           var midY = (p1.y + p2.y) / 2;
           orthoRoute.push({x: p1.x, y: midY});
           orthoRoute.push({x: p2.x, y: midY});
        }
      }
      orthoRoute.push(route[route.length-1]);
      
      // Simplification of route
      var finalRoute = [orthoRoute[0]];
      for (var i = 1; i < orthoRoute.length - 1; i++) {
        var prev = finalRoute[finalRoute.length - 1];
        var curr = orthoRoute[i];
        var next = orthoRoute[i+1];
        if (Math.abs(prev.x - curr.x) < 1 && Math.abs(curr.x - next.x) < 1) continue;
        if (Math.abs(prev.y - curr.y) < 1 && Math.abs(curr.y - next.y) < 1) continue;
        finalRoute.push(curr);
      }
      finalRoute.push(orthoRoute[orthoRoute.length-1]);

      resultEdges.push({ source: e.source, target: e.target, points: finalRoute, data: e });
    });

    return { nodes: resultNodes, edges: resultEdges };
  };

  window.UMLAdvancedLayout = LayoutEngine;
})();
