"""Sample-level steps shared by the speech engines: decode, trim, level, encode.

Every narration is 24 kHz mono. Drama 3 clips are trimmed and matched to
-23 LUFS (EBU R128) so separately rendered cues sit at one level; at -23 every
clip gets there by gain alone under the -1 dBFS peak ceiling.
"""
import io
import sys
from math import gcd

import numpy as np

RATE = 24000
TARGET_LUFS = -23.0
PEAK_CEILING = 10 ** (-1 / 20)


def decode(data):
    """Decode an audio file's bytes to mono float32 at RATE."""
    import soundfile as sf
    from scipy.signal import resample_poly

    samples, rate = sf.read(io.BytesIO(data), dtype="float32", always_2d=True)
    samples = samples.mean(axis=1)
    if rate != RATE:
        common = gcd(rate, RATE)
        samples = resample_poly(samples, RATE // common, rate // common).astype("float32")
    return samples


def trim(samples, margin=0.08):
    """Cut leading and trailing silence, keeping `margin` seconds around the speech."""
    frame = int(0.02 * RATE)
    frames = len(samples) // frame
    if not frames:
        return samples
    rms = np.sqrt(np.mean(samples[:frames * frame].reshape(frames, frame) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    loud = np.flatnonzero(db > max(-50.0, db.max() - 45.0))
    if not len(loud):
        return samples
    start = max(0, loud[0] * frame - int(margin * RATE))
    end = min(len(samples), (loud[-1] + 1) * frame + int(margin * RATE))
    return samples[start:end]


def level(samples):
    """Match integrated loudness to TARGET_LUFS, never exceeding PEAK_CEILING."""
    import pyloudnorm

    meter = pyloudnorm.Meter(RATE)
    out = pyloudnorm.normalize.loudness(samples, meter.integrated_loudness(samples), TARGET_LUFS)
    peak = float(np.abs(out).max())
    if peak > PEAK_CEILING:
        # The clip now sits below TARGET_LUFS, so the loudness match no longer holds.
        print(f"WARNING: peak ceiling turned a clip down {20 * np.log10(peak / PEAK_CEILING):.1f} dB "
              f"below {TARGET_LUFS} LUFS", file=sys.stderr, flush=True)
        out = out * (PEAK_CEILING / peak)
    return out.astype("float32")


def write_mp3(path, samples):
    """Write the site's narration format: 48 kbps constant-bitrate MP3 at RATE."""
    import soundfile as sf

    # At 24 kHz, libsndfile maps compression from 160 down to 8 kbps.
    sf.write(path, samples, RATE, format="MP3", subtype="MPEG_LAYER_III",
             bitrate_mode="CONSTANT", compression_level=(160 - 48) / (160 - 8))
