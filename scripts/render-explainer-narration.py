"""Generate Kokoro narration, measured cue timings, captions and the TTS script.

Optional offline tooling: kokoro-onnx==0.6.1, soundfile>=0.13. Node and npm dependencies compile the source.
The site serves only the generated audio and text; it never downloads the model.
"""

import argparse
import hashlib
import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def spoken_form(text, pronunciations):
    for written in sorted(pronunciations, key=lambda word: (-len(word), word)):
        text = text.replace(written, pronunciations[written])
    return text


def timestamp(seconds):
    milliseconds = round(seconds * 1000)
    hours, remainder = divmod(milliseconds, 3600000)
    minutes, remainder = divmod(remainder, 60000)
    whole_seconds, milliseconds = divmod(remainder, 1000)
    return f"{hours:02}:{minutes:02}:{whole_seconds:02}.{milliseconds:03}"


def load_storyboard(topic):
    """Use the same validated compilation as Jekyll; no parallel schema parser."""
    result = subprocess.run(
        ["node", str(ROOT / "scripts/narration.js"), "compile", topic],
        check=True, capture_output=True, text=True,
    )
    return json.loads(result.stdout)["story"]


def render(args):
    storyboard = load_storyboard(args.topic)
    if args.check:
        cues = sum(len(scene["cues"]) for scene in storyboard["scenes"])
        print(f"Valid script: {len(storyboard['scenes'])} scenes, {cues} cues; speech {storyboard['speech_sha256']}")
        return
    if not args.model or not args.voices:
        raise ValueError("Audio rendering requires --model and --voices")
    import numpy as np
    import soundfile as sf
    from kokoro_onnx import Kokoro
    kokoro = Kokoro(args.model, args.voices)
    work = Path(args.work_dir or f"/tmp/{args.topic}-kokoro-render")
    work.mkdir(parents=True, exist_ok=True)
    for field in ('audio', 'captions', 'script'):
        (ROOT / storyboard[field].lstrip('/')).parent.mkdir(parents=True, exist_ok=True)
    voice, speed = storyboard["voice"], storyboard["speed"]
    frames, script, captions, scenes = [], [], ["WEBVTT", ""], []
    samples_so_far = 0
    sample_rate = 24000
    for scene in storyboard["scenes"]:
        timing = {"id": scene["id"], "start": samples_so_far / sample_rate, "cues": []}
        for index, cue in enumerate(scene["cues"]):
            spoken = spoken_form(cue["text"], storyboard["pronunciations"])
            key = hashlib.sha256(f"{voice}:{speed}:{spoken}".encode()).hexdigest()[:20]
            cached = work / f"{key}.wav"
            if cached.exists():
                samples, rate = sf.read(cached, dtype="float32")
            else:
                samples, rate = kokoro.create(spoken, voice=voice, speed=speed, lang="en-us")
                sf.write(cached, samples, rate, subtype="FLOAT")
            if rate != sample_rate:
                raise ValueError(f"Expected {sample_rate} Hz, received {rate}")
            pause = np.zeros(round(sample_rate * cue.get("pause_after", 0.55)), dtype="float32")
            start = samples_so_far / sample_rate
            frames.extend([samples, pause])
            # Speech ends before the pause; animated stages time words within it.
            speech_end = (samples_so_far + len(samples)) / sample_rate
            samples_so_far += len(samples) + len(pause)
            end = samples_so_far / sample_rate
            timing["cues"].append({"id": cue["id"], "start": start, "end": end, "speech_end": speech_end})
            script.append(spoken)
            captions.extend([f"{scene['id']}-{index + 1}", f"{timestamp(start)} --> {timestamp(end)}", cue["text"], ""])
            print(f"{scene['id']} {index + 1}: {start:.2f} - {end:.2f}", flush=True)
        timing["end"] = samples_so_far / sample_rate
        scenes.append(timing)
    audio = np.concatenate(frames)
    peak = float(np.max(np.abs(audio)))
    if peak > 0.95:
        audio *= 0.95 / peak
    wav_path = work / (Path(storyboard["audio"]).stem + ".wav")
    sf.write(wav_path, audio, sample_rate, subtype="PCM_16")
    # At 24 kHz, libsndfile maps compression from 160 down to 8 kbps.
    mp3_compression = (160 - 48) / (160 - 8)
    sf.write(ROOT / storyboard["audio"].lstrip("/"), audio, sample_rate,
             format="MP3", subtype="MPEG_LAYER_III", bitrate_mode="CONSTANT",
             compression_level=mp3_compression)
    manifest = {"duration": samples_so_far / sample_rate, "voice": voice, "speed": speed,
                "speech_sha256": storyboard["speech_sha256"], "scenes": scenes}
    (ROOT / f"_data/explainers/{args.topic}_timing.json").write_text(json.dumps(manifest, indent=2) + "\n")
    (ROOT / storyboard["script"].lstrip("/")).write_text("\n\n".join(script) + "\n")
    (ROOT / storyboard["captions"].lstrip("/")).write_text("\n".join(captions))
    print(f"Rendered {manifest['duration']:.1f}s with Kokoro {voice} at {speed}x", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--topic", required=True, help="ID under _data/narrations; no hard-coded topic list")
    parser.add_argument("--check", action="store_true", help="Validate the script without loading speech dependencies or writing audio")
    parser.add_argument("--model")
    parser.add_argument("--voices")
    parser.add_argument("--work-dir")
    render(parser.parse_args())
