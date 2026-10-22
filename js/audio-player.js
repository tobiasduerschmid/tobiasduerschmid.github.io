
document.addEventListener('DOMContentLoaded', () => {
    // ── Global State Persistence ───────────────────────────────
    const STORAGE_KEY_VOL = 'cap_volume';
    const STORAGE_KEY_SPEED = 'cap_speed';

    function readPreference(key, minimum, maximum, fallback) {
        try {
            const stored = localStorage.getItem(key);
            if (stored === null || stored.trim() === '') return fallback;
            const value = Number(stored);
            return Number.isFinite(value) && value >= minimum && value <= maximum ? value : fallback;
        } catch (error) {
            // Playback still works when browser policy prevents saved preferences.
            return fallback;
        }
    }

    function savePreference(key, value) {
        try { localStorage.setItem(key, value); }
        catch (error) { /* Keep the current playback setting when storage is unavailable. */ }
    }

    document.querySelectorAll('.cap').forEach(player => {
        const audio       = player.querySelector('.cap__audio');
        const playBtn     = player.querySelector('.cap__play-btn');
        const progress    = player.querySelector('.cap__progress');
        const volumeSlider = player.querySelector('.cap__volume-slider');
        const volBtn      = player.querySelector('.cap__vol-btn');
        const volIcon     = player.querySelector('.cap__vol-icon');
        const timeCur     = player.querySelector('.cap__time--cur');
        const timeDur     = player.querySelector('.cap__time--dur');
        const speedBtns   = player.querySelectorAll('.cap__speed-btn');
        const skipBtns    = player.querySelectorAll('.cap__skip-btn');
        const prevBtn     = player.querySelector('.cap__ctrl-btn--prev');
        const nextBtn     = player.querySelector('.cap__ctrl-btn--next');

        // ── Initialization from Persistence ──────────────────────
        audio.volume = readPreference(STORAGE_KEY_VOL, 0, 1, audio.volume);
        if (volumeSlider) volumeSlider.value = audio.volume;

        audio.playbackRate = readPreference(STORAGE_KEY_SPEED, 0.5, 2, audio.playbackRate);
        speedBtns.forEach(btn => {
            const match = parseFloat(btn.dataset.speed) === audio.playbackRate;
            btn.classList.toggle('is-active', match);
            btn.setAttribute('aria-pressed', match ? 'true' : 'false');
        });

        // ── Helpers ──────────────────────────────────────────────
        function fmt(s) {
            if (!isFinite(s) || isNaN(s)) return '--:--';
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const sec = Math.floor(s % 60);
            const mm = h > 0 ? `${h}:${String(m).padStart(2,'0')}` : `${m}`;
            return `${mm}:${String(sec).padStart(2,'0')}`;
        }

        function setVolIcon(v) {
            volIcon.className = 'fa-solid cap__vol-icon ' +
                (v === 0 ? 'fa-volume-xmark' : v < 0.4 ? 'fa-volume-low' : 'fa-volume-high');
            if (volBtn) {
                const muted = v === 0;
                volBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
                volBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
                volBtn.setAttribute('data-original-title', muted ? 'Unmute' : 'Mute');
                volBtn.removeAttribute('title');
            }
        }

        setVolIcon(audio.volume);

        // ── Metadata / time ──────────────────────────────────────
        function updateDuration() {
            if (!isNaN(audio.duration) && audio.duration > 0) {
                timeDur.textContent = fmt(audio.duration);
            }
        }

        audio.addEventListener('loadedmetadata', updateDuration);

        // Handle cases where metadata is already loaded (e.g. cached files)
        if (audio.readyState >= 1) {
            updateDuration();
        }

        // Re-apply speed on load (some browsers reset playbackRate on src change)
        audio.addEventListener('loadstart', () => {
            audio.playbackRate = readPreference(STORAGE_KEY_SPEED, 0.5, 2, audio.playbackRate);
        });

        audio.addEventListener('timeupdate', () => {
            if (!isNaN(audio.duration) && audio.duration > 0) {
                progress.value = (audio.currentTime / audio.duration) * 100;
                timeCur.textContent = fmt(audio.currentTime);
            }
        });

        function setPlayBtnState(playing) {
            playBtn.classList.toggle('is-playing', playing);
            playBtn.innerHTML = playing
                ? '<i class="fa-solid fa-pause" aria-hidden="true"></i>'
                : '<i class="fa-solid fa-play" aria-hidden="true"></i>';
            playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
            playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
        }

        audio.addEventListener('ended', () => { setPlayBtnState(false); });
        audio.addEventListener('play',  () => { setPlayBtnState(true);  });
        audio.addEventListener('pause', () => { setPlayBtnState(false); });

        // ── Play / Pause ─────────────────────────────────────────
        playBtn.addEventListener('click', () => {
            if (audio.paused) audio.play();
            else              audio.pause();
        });

        // ── Seek ─────────────────────────────────────────────────
        progress.addEventListener('input', () => {
            if (!isNaN(audio.duration)) {
                audio.currentTime = (progress.value / 100) * audio.duration;
            }
        });

        // ── Skip ±15 s ───────────────────────────────────────────
        skipBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                audio.currentTime = Math.max(0,
                    Math.min(audio.duration || 0, audio.currentTime + parseFloat(btn.dataset.skip)));
            });
        });

        // ── Prev (restart) / Next (jump to end) ──────────────────
        if (prevBtn) prevBtn.addEventListener('click', () => { audio.currentTime = 0; });
        if (nextBtn) nextBtn.addEventListener('click', () => {
            if (!isNaN(audio.duration)) audio.currentTime = audio.duration;
        });

        // ── Speed presets ────────────────────────────────────────
        speedBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const speed = parseFloat(btn.dataset.speed);
                speedBtns.forEach(b => {
                    b.classList.remove('is-active');
                    b.setAttribute('aria-pressed', 'false');
                });
                btn.classList.add('is-active');
                btn.setAttribute('aria-pressed', 'true');
                audio.playbackRate = speed;
                savePreference(STORAGE_KEY_SPEED, speed);
            });
        });

        // ── Volume ───────────────────────────────────────────────
        volumeSlider.addEventListener('input', () => {
            const vol = parseFloat(volumeSlider.value);
            audio.volume = vol;
            setVolIcon(vol);
            savePreference(STORAGE_KEY_VOL, vol);
        });

        let prevVol = 1;
        if (volBtn) volBtn.addEventListener('click', () => {
            if (audio.volume > 0) {
                prevVol = audio.volume;
                audio.volume = 0;
                volumeSlider.value = 0;
            } else {
                audio.volume = prevVol;
                volumeSlider.value = prevVol;
            }
            setVolIcon(audio.volume);
            savePreference(STORAGE_KEY_VOL, audio.volume);
        });
    });
});
