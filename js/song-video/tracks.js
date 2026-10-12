/* Map the described recording's narration holds onto the original choreography. */
(function () {
  'use strict';

  function songPosition(plan, time) {
    const hold = plan.holds.findLast((item) => item.outputStart <= time) || plan.holds[0];
    if (time < hold.outputEnd) return { songTime: hold.songTime, sceneTime: hold.pictureTime };
    const songTime = hold.songTime + time - hold.outputEnd;
    return { songTime, sceneTime: songTime };
  }

  function describedPosition(plan, songTime) {
    if (songTime <= 0) return 0;
    const hold = plan.holds.findLast((item) => item.songTime <= songTime) || plan.holds[0];
    return Math.min(plan.duration, hold.outputEnd + songTime - hold.songTime);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { songPosition, describedPosition };
    return;
  }

  function bind({ player, audio, listen, signal, onLoading, onChange, onError }) {
    const select = player.querySelector('.song-player-track');
    const source = audio.querySelector('source');
    const captions = audio.querySelector('track');
    const original = { src: source.src, captions: captions.src };
    let active = 'original';
    let plan = null;
    let planRequest = null;
    let generation = 0;
    let pending = null;

    const position = () => active === 'described'
      ? songPosition(plan, audio.currentTime)
      : { songTime: audio.currentTime, sceneTime: audio.currentTime };

    async function loadPlan() {
      if (!planRequest) planRequest = fetch(select.dataset.describedTimeline, { signal })
        .then((response) => {
          if (!response.ok) throw new Error('Description timeline unavailable');
          return response.json();
        }).then((data) => {
          if (!data.holds?.length || !Number.isFinite(data.duration)) throw new Error('Invalid description timeline');
          plan = data;
          return data;
        }).catch((error) => { planRequest = null; throw error; });
      return planRequest;
    }

    listen(select, 'change', async () => {
      const request = ++generation;
      const next = select.value;
      try {
        if (next === 'described') await loadPlan();
        if (signal.aborted || request !== generation || next === active) return;
        const songTime = pending ? pending.songTime : position().songTime;
        const resume = pending ? pending.resume : !audio.paused && !audio.ended;
        audio.pause();
        active = next;
        pending = {
          songTime, resume,
          time: next === 'described' ? describedPosition(plan, songTime) : songTime,
        };
        onLoading(true);
        source.src = next === 'described' ? select.dataset.describedSrc : original.src;
        captions.src = next === 'described' ? select.dataset.describedCaptions : original.captions;
        captions.track.mode = 'hidden';
        audio.preload = 'metadata';
        audio.load();
      } catch (error) {
        if (signal.aborted || request !== generation) return;
        select.value = active;
        onLoading(false);
        onError('Audio description could not load. You can use the audio downloads or full transcript.');
      }
    });

    listen(audio, 'loadedmetadata', async () => {
      if (!pending || audio.currentSrc !== source.src) return;
      const change = pending;
      pending = null;
      audio.currentTime = Math.max(0, Math.min(audio.duration, change.time));
      onLoading(false);
      onChange();
      if (change.resume) {
        try { await audio.play(); }
        catch (error) {
          if (error.name !== 'AbortError') onError('Press play to continue with the selected audio track.');
        }
      }
    });
    const loadFailed = () => {
      // A failed load resets native currentTime to zero. Retain the requested
      // song position so choosing the other track can recover where we left off.
      if (pending) pending.resume = false;
      onLoading(false);
    };
    listen(audio, 'error', loadFailed);
    listen(source, 'error', loadFailed);
    return {
      position,
      mediaTime: (songTime) => active === 'described' ? describedPosition(plan, songTime) : songTime,
      pause() {
        if (pending) pending.resume = false;
        audio.pause();
      },
    };
  }

  window.SongTracks = { bind };
})();
