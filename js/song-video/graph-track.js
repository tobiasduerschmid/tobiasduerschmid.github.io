/*
 * GraphTrack — one GitGraph panel that steps through a list of Git states,
 * showing GitGraph's own transition animations (js/git-graph.js) posed at an
 * exact time, so the render stage can capture any frame in any order.
 *
 *   const track = new GraphTrack(panel, [{ at: 12.4, state }, …], { speed });
 *   track.pose(t);   // t in seconds of song time
 *
 * `state` uses the SEBook command-lab format: { log, branches, head, files }
 * (see GitGraph.parseGitState), plus optional `highlights` ({ hash: color }).
 * Before the first keyframe the panel shows the
 * first state; between keyframes it shows the transition from the previous
 * state, played `speed` times faster than on the page so a 720 ms glide fits
 * the song's tempo.
 *
 * Each track owns a clock and retains its graph while time moves forward
 * within a keyframe. On a backward seek or keyframe change it reconstructs
 * the previous state, settles it, then starts the target transition. This
 * makes every pose independent of seek history without rebuilding every
 * frame. Call dispose() when the scene is released.
 */
(function () {
  'use strict';

  // Longer than GitGraph's slowest chain: a 720 ms glide whose cleanup timer
  // fires at 900 ms, plus edge draw-ins that start two animation frames late.
  const SETTLE_MS = 1600;

  /** Parses a command-lab state; `highlights` ({ hash: color }) recolors commits. */
  function parseState(spec) {
    const state = GitGraph.parseGitState(spec.log, spec.branches, spec.head, spec.files);
    for (const [hash, color] of Object.entries(spec.highlights || {})) {
      if (state.commitMap[hash]) state.commitMap[hash].highlight = color;
    }
    return state;
  }

  /** Pauses every animation under `root` that has not been seen yet and records when it started. */
  function stampAnimations(root, stamps, at) {
    for (const animation of root.getAnimations({ subtree: true })) {
      if (stamps.has(animation)) continue;
      animation.pause();
      stamps.set(animation, at);
    }
  }

  function poseAnimations(root, stamps, now) {
    for (const animation of root.getAnimations({ subtree: true })) {
      const startedAt = stamps.get(animation);
      if (startedAt !== undefined) animation.currentTime = now - startedAt;
    }
  }

  class GraphTrack {
    constructor(panel, keyframes, { speed = 1 } = {}) {
      this.panel = panel;
      this.keyframes = keyframes.map((key) => ({ at: key.at, state: parseState(key.state) }));
      this.speed = speed;
      this.clock = window.VirtualClock.create();
      this.shown = null;
    }

    pose(t) {
      const index = this.keyframeIndexAt(t);
      const key = this.keyframes[index];
      const elapsedMs = Math.max(0, (t - key.at) * 1000 * this.speed);
      const target = SETTLE_MS + elapsedMs;
      if (!this.shown || this.shown.index !== index || target < this.clock.now()) {
        this.buildTransition(index);
      }
      this.advanceTo(target);
    }

    keyframeIndexAt(t) {
      let index = 0;
      for (let i = 1; i < this.keyframes.length; i++) {
        if (this.keyframes[i].at <= t) index = i;
      }
      return index;
    }

    buildTransition(index) {
      this.dispose();
      const canvas = document.createElement('div');
      canvas.className = 'git-graph-canvas song-graph-canvas';
      this.panel.replaceChildren(canvas);
      const graph = new window.GitGraph(canvas, {
        scheduler: this.clock,
        portablePaths: true,
        motion: 'full',
        perfLite: false,
        observeTheme: false,
        colorMode: 'dark',
      });
      graph.reserveForStates(this.keyframes.map((key) => key.state));
      const stamps = new WeakMap();
      this.shown = { index, graph, canvas, stamps };
      graph.render(this.keyframes[Math.max(0, index - 1)].state);
      stampAnimations(canvas, stamps, 0);
      this.advanceTo(SETTLE_MS);
      if (index > 0) {
        graph.render(this.keyframes[index].state);
        stampAnimations(canvas, stamps, SETTLE_MS);
      }
    }

    advanceTo(target) {
      const { graph, canvas, stamps } = this.shown;
      this.clock.advanceTo(target, (now) => {
        graph.posePaths(now);
        stampAnimations(canvas, stamps, now);
      });
      graph.posePaths(target);
      poseAnimations(canvas, stamps, target);
    }

    dispose() {
      if (this.shown) this.shown.graph.dispose();
      this.shown = null;
      this.clock.reset();
    }
  }

  window.GraphTrack = GraphTrack;
})();
