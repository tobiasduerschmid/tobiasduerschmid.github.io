
document.addEventListener('DOMContentLoaded', () => {
    // ── Global State Persistence ───────────────────────────────
    const STORAGE_KEY_VOL = 'cap_volume';
    const STORAGE_KEY_SPEED = 'cap_speed';

    document.querySelectorAll('.cap').forEach(player => {
        const audio       = player.querySelector('.cap__audio');
        const playBtn     = player.querySelector('.cap__play-btn');
        const progress    = player.querySelector('.cap__progress');
        const volumeSlider = player.querySelector('.cap__volume-slider');
        const volIcon     = player.querySelector('.cap__vol-icon');
        const timeCur     = player.querySelector('.cap__time--cur');
        const timeDur     = player.querySelector('.cap__time--dur');
        const speedBtns   = player.querySelectorAll('.cap__speed-btn');
        const skipBtns    = player.querySelectorAll('.cap__skip-btn');
        const prevBtn     = player.querySelector('.cap__ctrl-btn--prev');
        const nextBtn     = player.querySelector('.cap__ctrl-btn--next');

        // ── Initialization from Persistence ──────────────────────
        const savedVol = localStorage.getItem(STORAGE_KEY_VOL);
        if (savedVol !== null) {
            audio.volume = parseFloat(savedVol);
            if (volumeSlider) volumeSlider.value = savedVol;
        }

        const savedSpeed = localStorage.getItem(STORAGE_KEY_SPEED);
        if (savedSpeed !== null) {
            const speed = parseFloat(savedSpeed);
            audio.playbackRate = speed;
            // Update active state on buttons
            speedBtns.forEach(btn => {
                if (parseFloat(btn.dataset.speed) === speed) {
                    btn.classList.add('is-active');
                } else {
                    btn.classList.remove('is-active');
                }
            });
        }

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
            const currentSpeed = localStorage.getItem(STORAGE_KEY_SPEED);
            if (currentSpeed) audio.playbackRate = parseFloat(currentSpeed);
        });

        audio.addEventListener('timeupdate', () => {
            if (!isNaN(audio.duration) && audio.duration > 0) {
                progress.value = (audio.currentTime / audio.duration) * 100;
                timeCur.textContent = fmt(audio.currentTime);
            }
        });

        audio.addEventListener('ended', () => {
            playBtn.classList.remove('is-playing');
            playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        });

        // ── Play / Pause ─────────────────────────────────────────
        playBtn.addEventListener('click', () => {
            if (audio.paused) {
                audio.play();
                playBtn.classList.add('is-playing');
                playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            } else {
                audio.pause();
                playBtn.classList.remove('is-playing');
                playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            }
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
                speedBtns.forEach(b => b.classList.remove('is-active'));
                btn.classList.add('is-active');
                audio.playbackRate = speed;
                localStorage.setItem(STORAGE_KEY_SPEED, speed);
            });
        });

        // ── Volume ───────────────────────────────────────────────
        volumeSlider.addEventListener('input', () => {
            const vol = parseFloat(volumeSlider.value);
            audio.volume = vol;
            setVolIcon(vol);
            localStorage.setItem(STORAGE_KEY_VOL, vol);
        });

        let prevVol = 1;
        volIcon.addEventListener('click', () => {
            if (audio.volume > 0) {
                prevVol = audio.volume;
                audio.volume = 0;
                volumeSlider.value = 0;
            } else {
                audio.volume = prevVol;
                volumeSlider.value = prevVol;
            }
            setVolIcon(audio.volume);
            localStorage.setItem(STORAGE_KEY_VOL, audio.volume);
        });
    });
});
