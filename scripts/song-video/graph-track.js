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
 * How a frame is posed: a fresh GitGraph renders the previous state and is
 * fast-forwarded until every transition and cleanup timer has settled; then
 * it renders the target state and the virtual clock (virtual-clock.js) runs
 * GitGraph's timers up to the frame's moment. CSS animations and transitions
 * are paused the moment they appear, stamped with the virtual time they
 * started, and seeked to that age. Each frame is therefore a pure function
 * of t.
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
      this.shown = null; // { index, canvas, stamps } while a settled state is on screen
    }

    pose(t) {
      const index = this.keyframeIndexAt(t);
      const key = this.keyframes[index];
      const elapsedMs = Math.max(0, (t - key.at) * 1000 * this.speed);
      if (index === 0 || elapsedMs >= SETTLE_MS) {
        this.showSettled(index, elapsedMs);
      } else {
        this.showTransition(index, elapsedMs);
      }
    }

    keyframeIndexAt(t) {
      let index = 0;
      for (let i = 1; i < this.keyframes.length; i++) {
        if (this.keyframes[i].at <= t) index = i;
      }
      return index;
    }

    /** A fresh graph showing keyframe `index` with every animation finished. */
    buildSettled(index) {
      const canvas = document.createElement('div');
      canvas.className = 'git-graph-canvas song-graph-canvas';
      this.panel.replaceChildren(canvas);
      window.VirtualClock.reset();
      const graph = new window.GitGraph(canvas);
      graph.reserveForStates(this.keyframes.map((key) => key.state));
      const stamps = new WeakMap();
      graph.render(this.keyframes[index].state);
      stampAnimations(canvas, stamps, 0);
      window.VirtualClock.advanceTo(SETTLE_MS, (now) => stampAnimations(canvas, stamps, now));
      poseAnimations(canvas, stamps, SETTLE_MS);
      return { graph, canvas, stamps };
    }

    showSettled(index, elapsedMs) {
      if (!this.shown || this.shown.index !== index) {
        const { canvas, stamps } = this.buildSettled(index);
        this.shown = { index, canvas, stamps };
      }
      // Only looping animations (the HEAD glow's pulse) are still running.
      poseAnimations(this.shown.canvas, this.shown.stamps, SETTLE_MS + elapsedMs);
    }

    showTransition(index, elapsedMs) {
      const { graph, canvas, stamps } = this.buildSettled(index - 1);
      this.shown = null;
      const start = window.VirtualClock.now();
      graph.render(this.keyframes[index].state);
      stampAnimations(canvas, stamps, start);
      window.VirtualClock.advanceTo(start + elapsedMs, (now) => stampAnimations(canvas, stamps, now));
      poseAnimations(canvas, stamps, start + elapsedMs);
    }
  }

  window.GraphTrack = GraphTrack;
})();
