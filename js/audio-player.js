
document.addEventListener('DOMContentLoaded', () => {
    const players = document.querySelectorAll('.custom-audio-player');
    
    players.forEach(player => {
        const audio = player.querySelector('audio');
        const playBtn = player.querySelector('.play-pause-btn');
        const progress = player.querySelector('.progress-container input[type="range"]');
        const speed = player.querySelector('.speed-control select');
        const currentTimeDisplay = player.querySelector('.time.current');
        const totalTimeDisplay = player.querySelector('.time.total');
        const volumeSlider = player.querySelector('.volume-control input[type="range"]');
        const muteBtn = player.querySelector('.volume-control i');

        // Play/Pause
        playBtn.addEventListener('click', () => {
            if (audio.paused) {
                audio.play();
                playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            } else {
                audio.pause();
                playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            }
        });

        // Update progress bar
        audio.addEventListener('timeupdate', () => {
            if (!isNaN(audio.duration)) {
                const pct = (audio.currentTime / audio.duration) * 100;
                progress.value = pct;
                currentTimeDisplay.textContent = formatTime(audio.currentTime);
            }
        });

        // Load metadata
        audio.addEventListener('loadedmetadata', () => {
            totalTimeDisplay.textContent = formatTime(audio.duration);
        });

        // Seek
        progress.addEventListener('input', () => {
            const time = (progress.value / 100) * audio.duration;
            audio.currentTime = time;
        });

        // Speed control
        speed.addEventListener('change', () => {
            audio.playbackRate = parseFloat(speed.value);
        });

        // Volume control
        volumeSlider.addEventListener('input', () => {
            audio.volume = volumeSlider.value;
            updateVolumeIcon(audio.volume);
        });

        muteBtn.addEventListener('click', () => {
            if (audio.volume > 0) {
                audio.dataset.prevVolume = audio.volume;
                audio.volume = 0;
                volumeSlider.value = 0;
            } else {
                audio.volume = audio.dataset.prevVolume || 1;
                volumeSlider.value = audio.volume;
            }
            updateVolumeIcon(audio.volume);
        });

        function updateVolumeIcon(vol) {
            if (vol === 0) {
                muteBtn.className = 'fa-solid fa-volume-off';
            } else if (vol < 0.5) {
                muteBtn.className = 'fa-solid fa-volume-down';
            } else {
                muteBtn.className = 'fa-solid fa-volume-up';
            }
        }

        function formatTime(seconds) {
            if (isNaN(seconds)) return "0:00";
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            if (h > 0) {
                return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
            }
            return `${m}:${s < 10 ? '0' : ''}${s}`;
        }
    });
});
