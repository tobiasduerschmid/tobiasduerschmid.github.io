"""Resolve a narration's `speech.voice` to the speaker that renders it.

A registered voice is a folder `voices/<id>/` holding voice.json (its engine and
settings) and any files that engine needs. Any other ID is a Kokoro voice.
"""
import json
from pathlib import Path

VOICES = Path(__file__).resolve().parent / "voices"


def registered_voice(voice_id):
    """The voice's folder, or None when `voice_id` is not registered (a Kokoro voice)."""
    folder = VOICES / voice_id
    return folder if (folder / "voice.json").is_file() else None


def open_speaker(voice_id, speed, *, model=None, voices=None, server="http://127.0.0.1:8000", takes=3):
    """A speaker for `voice_id`; `model`/`voices` serve Kokoro, `server`/`takes` serve Drama 3."""
    folder = registered_voice(voice_id)
    if folder is None:
        from .kokoro_speaker import KokoroSpeaker

        return KokoroSpeaker(voice_id, speed, model=model, voices=voices)
    engine = json.loads((folder / "voice.json").read_text())["engine"]
    if engine == "drama3":
        from .drama3_speaker import Drama3Speaker, Drama3Voice

        return Drama3Speaker(voice_id, Drama3Voice.load(folder), speed, server=server, takes=takes)
    raise ValueError(f"{folder / 'voice.json'}: unknown engine {engine!r}")
