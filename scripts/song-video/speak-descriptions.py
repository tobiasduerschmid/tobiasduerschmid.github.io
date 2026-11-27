# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["numpy", "scipy", "soundfile>=0.13", "pyloudnorm", "num2words", "mlx-whisper"]
# ///
"""Render one song's section descriptions with the shared, transcript-checked speech engine."""
import json
import sys
from math import gcd
from pathlib import Path
from urllib.parse import quote

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from narration_speech.audio import RATE
from narration_speech.cache import cue_speech
from narration_speech.voices import open_speaker


def main(work, mix_rate):
    storyboard = json.load(sys.stdin)
    retakes = set(storyboard.get("retakes", []))
    sentence_ids = {f"{section['id']}/{number}"
                    for section in storyboard["sections"]
                    for number in range(1, len(section["sentences"]) + 1)}
    unknown = retakes - sentence_ids
    if unknown:
        raise ValueError(f"Unknown --retake sentence: {', '.join(sorted(unknown))}")
    speaker = open_speaker(storyboard["voice"], 1)
    common = gcd(RATE, mix_rate)
    sentence_timings = []
    gap = np.zeros(round(0.2 * mix_rate), dtype="float32")
    for index, section in enumerate(storyboard["sections"]):
        frames, timings = [], []
        cursor = 0
        for number, sentence in enumerate(section["sentences"], start=1):
            cue_id = f"{section['id']}/{number}"
            # Identical lines share their first take. An explicit retake belongs
            # to this occurrence, including when a later render reuses it.
            override = work / "retakes" / quote(cue_id, safe="")
            if cue_id in retakes:
                override.mkdir(parents=True, exist_ok=True)
            cache = override if override.is_dir() else work
            speech = cue_speech(speaker, cache, sentence["spoken"], sentence["written"], cue_id in retakes)
            if speech.needs_review:
                print(f"Review {cue_id}: {', '.join(speech.mismatch.differences(speech.heard))}", flush=True)
            if frames:
                frames.append(gap)
                cursor += len(gap)
            samples = resample_poly(speech.samples, mix_rate // common, RATE // common)
            timings.append({"start": cursor / mix_rate, "end": (cursor + len(samples)) / mix_rate})
            frames.append(samples)
            cursor += len(samples)
        sf.write(work / f"narration-{index}.wav", np.concatenate(frames), mix_rate, subtype="PCM_16")
        sentence_timings.append(timings)
        print(f"  {section['id']}: {cursor / mix_rate:.2f} s", flush=True)
    (work / "narration-timing.json").write_text(json.dumps(sentence_timings))


if __name__ == "__main__":
    main(Path(sys.argv[1]), int(sys.argv[2]))
