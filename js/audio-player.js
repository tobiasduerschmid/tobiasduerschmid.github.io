
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

    function formatTime(seconds) {
        if (!Number.isFinite(seconds)) return '--:--';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor(seconds / 60) % 60;
        const clockMinutes = hours ? hours + ':' + String(minutes).padStart(2, '0') : minutes;
        return clockMinutes + ':' + String(Math.floor(seconds) % 60).padStart(2, '0');
    }

    function bindSectionPreview(seek, audio, sectionAt) {
        const timeline = seek.closest('.cap__progress-wrap');
        const track = timeline.querySelector('.cap__progress-track');
        const tip = timeline.querySelector('[role="tooltip"]');
        const title = tip.querySelector('.cap__preview-title');
        const time = tip.querySelector('.cap__preview-time');
        const navbar = document.getElementById('navnav');
        let fraction = 0;

        function hide() {
            tip.hidden = true;
            seek.removeAttribute('aria-describedby');
            track.querySelector('.is-previewed')?.classList.remove('is-previewed');
        }

        function position() {
            if (tip.hidden) return;
            const bounds = seek.getBoundingClientRect();
            const rail = track.getBoundingClientRect();
            const navBottom = navbar?.getBoundingClientRect().bottom || 0;
            if (!rail.width || bounds.bottom <= navBottom || bounds.top >= window.innerHeight) {
                hide();
                return;
            }
            const left = rail.left + fraction * rail.width - tip.offsetWidth / 2;
            const top = bounds.top - tip.offsetHeight;
            tip.style.left = Math.max(8, Math.min(document.documentElement.clientWidth - tip.offsetWidth - 8, left)) + 'px';
            tip.style.top = (top >= navBottom ? top : bounds.bottom) + 'px';
        }

        function show(atFraction) {
            if (!Number.isFinite(audio.duration)) return;
            fraction = Math.max(0, Math.min(1, atFraction));
            const seconds = fraction * audio.duration;
            const section = sectionAt(seconds);
            title.textContent = section.text;
            time.textContent = formatTime(seconds);
            track.querySelector('.is-previewed')?.classList.remove('is-previewed');
            track.children[section.index]?.classList.add('is-previewed');
            tip.hidden = false;
            seek.setAttribute('aria-describedby', tip.id);
            position();
        }

        seek.addEventListener('pointermove', event => {
            if (event.pointerType === 'touch') return;
            const rail = track.getBoundingClientRect();
            show((event.clientX - rail.left) / rail.width);
        });
        const showSeekPosition = () => show(Number(seek.value) / 100);
        const showKeyboardPosition = () => {
            if (seek.matches(':focus-visible')) showSeekPosition();
        };
        seek.addEventListener('focus', showKeyboardPosition);
        seek.addEventListener('input', showKeyboardPosition);
        timeline.addEventListener('pointerleave', () => {
            if (tip.hidden) return;
            if (seek.matches(':focus-visible')) showSeekPosition();
            else hide();
        });
        seek.addEventListener('blur', hide);
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !tip.hidden) hide();
        });
        window.addEventListener('scroll', position, { passive: true });
        window.addEventListener('resize', position);
    }

    function initFloatingControls(player, audio, playButton) {
        const slot = player.closest('.cap-slot');
        const more = player.querySelector('.cap__more-controls');
        const settingsGroups = more.getAttribute('aria-controls').split(' ').map(id => document.getElementById(id));
        const navbar = document.getElementById('navnav');
        const root = document.documentElement;
        let following = false;
        let inlinePlayOffset = 0;

        function setExpanded(expanded) {
            player.classList.toggle('is-expanded', expanded);
            more.setAttribute('aria-expanded', String(expanded));
        }

        function setDocked(docked) {
            if (player.classList.contains('is-docked') === docked) return;
            const focused = document.activeElement;
            if (docked) {
                // Reserve the inline space before taking the controls out of the article.
                slot.style.setProperty('--cap-inline-height', slot.getBoundingClientRect().height + 'px');
            } else {
                root.style.removeProperty('--cap-dock-height');
                slot.style.removeProperty('--cap-inline-height');
            }
            setExpanded(docked && settingsGroups.some(group => group.contains(focused)));
            player.classList.toggle('is-docked', docked);
            if (!docked && focused === more) playButton.focus({ preventScroll: true });
        }

        function updatePosition() {
            if (!following || !slot.offsetHeight) return;
            const slotTop = slot.getBoundingClientRect().top;
            if (!player.classList.contains('is-docked')) {
                inlinePlayOffset = playButton.getBoundingClientRect().top - slotTop;
            }
            const playTop = slotTop + inlinePlayOffset;
            const navBottom = navbar ? navbar.getBoundingClientRect().bottom : 0;
            setDocked(playTop < navBottom || playTop + playButton.offsetHeight > root.clientHeight);
        }

        function stopFollowing() {
            following = false;
            setDocked(false);
        }

        function revealCoveredFocus() {
            const focused = document.activeElement;
            if (!player.classList.contains('is-docked') || !focused || focused === document.body || player.contains(focused)) return;
            const target = focused.getBoundingClientRect();
            const bar = player.getBoundingClientRect();
            const overlaps = target.bottom > bar.top && target.top < bar.bottom && target.right > bar.left && target.left < bar.right;
            if (overlaps && target.height < bar.top) {
                window.scrollBy({ top: Math.ceil(target.bottom - bar.top) + 4, behavior: 'instant' });
            }
        }

        const sizes = new ResizeObserver(() => {
            updatePosition();
            if (player.classList.contains('is-docked')) {
                root.style.setProperty('--cap-dock-height', player.offsetHeight + 'px');
                revealCoveredFocus();
            }
        });
        sizes.observe(player);
        if (navbar) sizes.observe(navbar);
        window.addEventListener('scroll', updatePosition, { passive: true });
        window.addEventListener('resize', updatePosition);
        document.addEventListener('focusin', () => {
            if (following) requestAnimationFrame(revealCoveredFocus);
        });
        more.addEventListener('click', () => setExpanded(more.getAttribute('aria-expanded') !== 'true'));
        audio.addEventListener('playing', () => {
            following = true;
            updatePosition();
        });
        audio.addEventListener('ended', stopFollowing);
        audio.addEventListener('error', stopFollowing);
        document.getElementById('readAloudToggle')?.addEventListener('change', event => {
            if (!event.target.checked) {
                audio.pause();
                stopFollowing();
            }
        });
    }

    document.querySelectorAll('.cap').forEach(player => {
        const audio       = player.querySelector('.cap__audio');
        const playBtn     = player.querySelector('.cap__play-btn');
        const progress    = player.querySelector('.cap__progress');
        const progressTrack = player.querySelector('.cap__progress-track');
        const volumeSlider = player.querySelector('.cap__volume-slider');
        const volBtn      = player.querySelector('.cap__vol-btn');
        const timeCur     = player.querySelector('.cap__time--cur');
        const timeDur     = player.querySelector('.cap__time--dur');
        const speedBtns   = player.querySelectorAll('.cap__speed-btn');
        const skipBtns    = player.querySelectorAll('.cap__skip-btn');
        const prevBtn     = player.querySelector('.cap__ctrl-btn--prev');
        const nextBtn     = player.querySelector('.cap__ctrl-btn--next');

        initFloatingControls(player, audio, playBtn);

        // ── Initialization from Persistence ──────────────────────
        audio.volume = readPreference(STORAGE_KEY_VOL, 0, 1, audio.volume);
        if (volumeSlider) volumeSlider.value = audio.volume;

        audio.playbackRate = readPreference(STORAGE_KEY_SPEED, 0.5, 2, audio.playbackRate);
        speedBtns.forEach(btn => {
            const match = parseFloat(btn.dataset.speed) === audio.playbackRate;
            btn.classList.toggle('is-active', match);
            btn.setAttribute('aria-pressed', match ? 'true' : 'false');
        });

        function updateMuteButton(volume) {
            if (volBtn) {
                const muted = volume === 0;
                volBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
                volBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
                volBtn.setAttribute('data-original-title', muted ? 'Unmute' : 'Mute');
                volBtn.removeAttribute('title');
            }
        }

        updateMuteButton(audio.volume);

        // ── Metadata / time ──────────────────────────────────────
        function updateDuration() {
            if (!isNaN(audio.duration) && audio.duration > 0) {
                timeDur.textContent = formatTime(audio.duration);
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
                const percent = (audio.currentTime / audio.duration) * 100;
                const elapsed = formatTime(audio.currentTime);
                progress.value = percent;
                progress.setAttribute('aria-valuetext', elapsed);
                progressTrack.style.setProperty('--cap-played', percent + '%');
                timeCur.textContent = elapsed;
            }
        });

        function setPlayBtnState(playing) {
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

        const sectionPicker = player.querySelector('.cap__chapter-jump select');
        if (sectionPicker) {
            const sectionStarts = Array.from(sectionPicker.options, option => Number(option.value));
            const chapterTitle = player.querySelector('.cap__chapter-title');
            let displayedSection;

            function drawSections() {
                if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
                const segments = sectionStarts.map((start, index) => {
                    const segment = document.createElement('span');
                    const end = sectionStarts[index + 1] ?? audio.duration;
                    segment.style.flexGrow = String(end - start);
                    return segment;
                });
                progressTrack.replaceChildren(...segments);
            }
            audio.addEventListener('durationchange', drawSections);
            drawSections();

            function sectionIndexAt(seconds) {
                // Match the precision of the section timestamps after a native seek.
                const position = Math.round(seconds * 1000) / 1000;
                const nextIndex = sectionStarts.findIndex(start => start > position);
                return nextIndex === -1 ? sectionStarts.length - 1 : Math.max(0, nextIndex - 1);
            }
            bindSectionPreview(progress, audio, seconds => sectionPicker.options[sectionIndexAt(seconds)]);

            function updateCurrentSection() {
                const index = sectionIndexAt(audio.currentTime);
                if (index === displayedSection) return;
                displayedSection = index;
                sectionPicker.selectedIndex = index;
                chapterTitle.textContent = sectionPicker.options[index].text;
                prevBtn.setAttribute('aria-disabled', String(index <= 0));
                nextBtn.setAttribute('aria-disabled', String(index === sectionStarts.length - 1));
            }

            function seekToSection(index) {
                if (index < 0 || index >= sectionStarts.length) return;
                audio.currentTime = sectionStarts[index];
                updateCurrentSection();
            }

            sectionPicker.addEventListener('change', () => seekToSection(sectionPicker.selectedIndex));
            prevBtn.addEventListener('click', () => seekToSection(sectionIndexAt(audio.currentTime) - 1));
            nextBtn.addEventListener('click', () => seekToSection(sectionIndexAt(audio.currentTime) + 1));
            audio.addEventListener('seeking', updateCurrentSection);
            audio.addEventListener('timeupdate', updateCurrentSection);
            updateCurrentSection();
        } else {
            if (prevBtn) prevBtn.addEventListener('click', () => { audio.currentTime = 0; });
            if (nextBtn) nextBtn.addEventListener('click', () => {
                if (!isNaN(audio.duration)) audio.currentTime = audio.duration;
            });
        }

        // ── Skip ±15 s ───────────────────────────────────────────
        skipBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                audio.currentTime = Math.max(0,
                    Math.min(audio.duration || 0, audio.currentTime + parseFloat(btn.dataset.skip)));
            });
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
            updateMuteButton(vol);
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
            updateMuteButton(audio.volume);
            savePreference(STORAGE_KEY_VOL, audio.volume);
        });
    });
});
