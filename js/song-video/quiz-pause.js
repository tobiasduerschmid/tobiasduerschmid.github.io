/* Stop the shared media clock just before each authored answer, once per encounter. */
(function () {
  'use strict';

  function checkpoints(lines) {
    return lines.filter((line) => Number.isFinite(line.answer_at)).map((line) => ({
      id: line.id, start: line.start, question: line.text,
      // Leave a small audio scheduling margin before the first answer syllable.
      time: line.pause_at ?? Math.max(line.start, line.answer_at - 0.12),
    })).sort((a, b) => a.time - b.time);
  }

  function bind({ audio, tracks, lines, listen, onPause, onResume }) {
    const points = checkpoints(lines);
    const passed = new Set();
    let enabled = false;
    let timer = null;
    let waiting = false;
    let lastTime = tracks.position().songTime;

    function cancelTimer() { clearTimeout(timer); timer = null; }
    function resetAfterSeek() {
      const time = tracks.position().songTime;
      for (const point of points) {
        if (time < point.time - 0.05) passed.delete(point.id);
        else if (time > point.time + 0.05) passed.add(point.id);
      }
      lastTime = time;
      schedule();
    }
    function schedule() {
      cancelTimer();
      if (!enabled || audio.paused || audio.seeking) return;
      const time = tracks.position().songTime;
      const point = points.find((item) => !passed.has(item.id) && item.time >= lastTime - 0.01);
      lastTime = time;
      if (!point) return;
      const remaining = (tracks.mediaTime(point.time) - audio.currentTime) / audio.playbackRate;
      if (remaining <= 0.008) {
        passed.add(point.id);
        waiting = true;
        tracks.pause();
        audio.currentTime = tracks.mediaTime(point.time);
        onPause(point.question);
        return;
      }
      timer = setTimeout(schedule, Math.min(50, Math.max(1, remaining * 1000 - 5)));
    }
    listen(audio, 'playing', () => {
      if (audio.paused) return; // Ignore a queued playing event after a checkpoint stopped playback.
      if (waiting) { waiting = false; onResume(); }
      schedule();
    });
    listen(audio, 'pause', cancelTimer);
    listen(audio, 'seeking', cancelTimer);
    listen(audio, 'seeked', resetAfterSeek);
    listen(audio, 'ratechange', schedule);
    listen(audio, 'timeupdate', schedule);
    listen(document, 'visibilitychange', () => {
      // Background tabs throttle timers. Pause instead of risking an unheard question
      // being followed by an answer while its checkpoint timer is suspended.
      if (enabled && document.hidden) tracks.pause();
    });
    listen(window, 'pagehide', cancelTimer);
    return {
      setEnabled(value) {
        enabled = value === true;
        resetAfterSeek();
      },
      question: () => waiting ? points.find((point) => Math.abs(point.time - tracks.position().songTime) < 0.05)?.question : null,
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { checkpoints };
  else window.SongQuizPause = { bind };
})();
