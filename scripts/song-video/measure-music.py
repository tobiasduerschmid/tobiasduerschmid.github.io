# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["numpy", "soundfile>=0.13", "pyloudnorm"]
# ///
"""Match the described cut's music to its stereo narration, leaving quiet songs alone."""
import math
import sys
from pathlib import Path

import numpy as np
import pyloudnorm
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from narration_speech.audio import TARGET_LUFS


def description_music_gain(samples, rate):
    """Linear song attenuation for a stereo mix, from BS.1770 integrated loudness."""
    if len(samples) == 0:
        return 1.0
    channels = 1 if samples.ndim == 1 else samples.shape[1]
    music = samples if channels == 1 else samples[:, :2]
    # BS.1770 gives two identical channels 3.01 LU more than the mono source.
    stereo_gain_lu = 10 * math.log10(2)
    block = min(0.4, len(samples) / rate)
    loudness = pyloudnorm.Meter(rate, block_size=block).integrated_loudness(music)
    if not np.isfinite(loudness):
        return 1.0
    if channels == 1:
        loudness += stereo_gain_lu
    target = TARGET_LUFS + stereo_gain_lu + 3
    return min(1.0, 10 ** ((target - loudness) / 20))


if __name__ == "__main__":
    samples, rate = sf.read(sys.argv[1], dtype="float32", always_2d=True)
    print(description_music_gain(samples, rate))
