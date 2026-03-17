
document.addEventListener('DOMContentLoaded', () => {
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

        // ── Metadata / time ──────────────────────────────────────
        audio.addEventListener('loadedmetadata', () => {
            timeDur.textContent = fmt(audio.duration);
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
                speedBtns.forEach(b => b.classList.remove('is-active'));
                btn.classList.add('is-active');
                audio.playbackRate = parseFloat(btn.dataset.speed);
            });
        });

        // ── Volume ───────────────────────────────────────────────
        volumeSlider.addEventListener('input', () => {
            audio.volume = parseFloat(volumeSlider.value);
            setVolIcon(audio.volume);
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
        });
    });
});
