"""Generate narration speech, measured cue timings, captions and the TTS script.

The narration's `speech.voice` picks the engine (scripts/narration_speech/voices.py):
a registered Fish Audio Drama 3 voice, rendered by a running Drama 3 server and
checked with Whisper, or a Kokoro voice ID. Optional offline tooling:
  Drama 3: numpy, scipy, soundfile>=0.13, pyloudnorm, num2words, mlx-whisper (Apple silicon)
  Kokoro:  numpy, soundfile>=0.13, kokoro-onnx==0.6.1
Node and npm dependencies compile the source. The site serves only the generated
audio and text; it never contacts a speech engine.
"""

import argparse
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
    text_only = "audio" not in storyboard
    if args.check:
        cues = sum(len(scene["cues"]) for scene in storyboard["scenes"])
        pending = "; text only until a media block is added" if text_only else ""
        print(f"Valid script: {len(storyboard['scenes'])} scenes, {cues} cues; speech {storyboard['speech_sha256']}{pending}")
        return
    if text_only:
        raise ValueError(f"{args.topic} is text only; add a media block (audio, captions, script under /assets/) before rendering")
    cue_ids = {f"{scene['id']}/{cue['id']}" for scene in storyboard["scenes"] for cue in scene["cues"]}
    unknown = sorted(set(args.retake) - cue_ids)
    if unknown:
        raise ValueError(f"--retake names no cue of {args.topic}: {', '.join(unknown)}")
    import numpy as np
    import soundfile as sf

    from narration_speech.cache import cue_speech
    from narration_speech.audio import RATE, write_mp3
    from narration_speech.voices import open_speaker

    voice, speed = storyboard["voice"], storyboard["speed"]
    speaker = open_speaker(voice, speed, model=args.model, voices=args.voices,
                           server=args.server, takes=args.takes)
    work = Path(args.work_dir).expanduser() if args.work_dir else Path.home() / ".cache/sebook-narration" / args.topic
    work.mkdir(parents=True, exist_ok=True)
    for field in ('audio', 'captions', 'script'):
        (ROOT / storyboard[field].lstrip('/')).parent.mkdir(parents=True, exist_ok=True)
    frames, script, captions, scenes, reviews = [], [], ["WEBVTT", ""], [], []
    samples_so_far = 0
    for scene in storyboard["scenes"]:
        timing = {"id": scene["id"], "start": samples_so_far / RATE, "cues": []}
        for index, cue in enumerate(scene["cues"]):
            spoken = spoken_form(cue["text"], storyboard["pronunciations"])
            cue_id = f"{scene['id']}/{cue['id']}"
            speech = cue_speech(speaker, work, spoken, cue["text"], cue_id in args.retake)
            if speech.needs_review:
                reviews.append((cue_id, speech))
            pause = np.zeros(round(RATE * cue.get("pause_after", 0.55)), dtype="float32")
            start = samples_so_far / RATE
            frames.extend([speech.samples, pause])
            # Speech ends before the pause; animated stages time words within it.
            speech_end = (samples_so_far + len(speech.samples)) / RATE
            samples_so_far += len(speech.samples) + len(pause)
            end = samples_so_far / RATE
            timing["cues"].append({"id": cue["id"], "start": start, "end": end, "speech_end": speech_end})
            script.append(spoken)
            captions.extend([f"{scene['id']}-{index + 1}", f"{timestamp(start)} --> {timestamp(end)}", cue["text"], ""])
            print(f"{scene['id']} {index + 1}: {start:.2f} - {end:.2f}", flush=True)
        timing["end"] = samples_so_far / RATE
        scenes.append(timing)
    audio = np.concatenate(frames)
    peak = float(np.max(np.abs(audio)))
    if peak > 0.95:
        audio *= 0.95 / peak
    sf.write(work / (Path(storyboard["audio"]).stem + ".wav"), audio, RATE, subtype="PCM_16")
    write_mp3(ROOT / storyboard["audio"].lstrip("/"), audio)
    manifest = {"duration": samples_so_far / RATE, "voice": voice, "speed": speed,
                "speech_sha256": storyboard["speech_sha256"], "scenes": scenes}
    (ROOT / f"_data/explainers/{args.topic}_timing.json").write_text(json.dumps(manifest, indent=2) + "\n")
    (ROOT / storyboard["script"].lstrip("/")).write_text("\n\n".join(script) + "\n")
    (ROOT / storyboard["captions"].lstrip("/")).write_text("\n".join(captions))
    print(f"Rendered {manifest['duration']:.1f}s with {speaker.name}", flush=True)
    if reviews:
        print(f"\n{len(reviews)} cues sound different from the script to Whisper. Listen to each; spelling "
              "variants are fine. Re-render a real slip with --retake <scene>/<cue>, or reword it "
              "with a pronunciation entry.")
        for cue_id, speech in reviews:
            print(f"  {cue_id}: {'; '.join(speech.mismatch.differences(speech.heard))}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--topic", required=True, help="ID under _data/narrations; no hard-coded topic list")
    parser.add_argument("--check", action="store_true", help="Validate the script without loading speech dependencies or writing audio")
    parser.add_argument("--model", help="Kokoro: path to kokoro.onnx")
    parser.add_argument("--voices", help="Kokoro: path to voices.bin")
    parser.add_argument("--server", default="http://127.0.0.1:8000", help="Drama 3: base URL of the sglang-omni server")
    parser.add_argument("--takes", type=int, default=3, help="Drama 3: most takes per cue; stops at one heard as written")
    parser.add_argument("--retake", nargs="*", default=[], metavar="SCENE/CUE",
                        help="Re-render these cues even when cached")
    parser.add_argument("--work-dir", help="Cue cache; default ~/.cache/sebook-narration/<topic>")
    render(parser.parse_args())
