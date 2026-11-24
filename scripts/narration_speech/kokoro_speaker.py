"""Kokoro (kokoro-onnx) speech: one deterministic take per cue, used as rendered."""
from .audio import RATE
from .speech import Speech


class KokoroSpeaker:
    def __init__(self, voice, speed, *, model, voices):
        if not model or not voices:
            raise ValueError(f"Kokoro voice {voice!r} requires --model and --voices")
        from kokoro_onnx import Kokoro

        self._kokoro = Kokoro(model, voices)
        self._voice, self._speed = voice, speed
        self.identity = f"{voice}:{speed}"  # the cache key prefix earlier Kokoro renders used
        self.name = f"Kokoro {voice} at {speed}x"

    def speak(self, spoken, written):
        samples, rate = self._kokoro.create(spoken, voice=self._voice, speed=self._speed, lang="en-us")
        if rate != RATE:
            raise ValueError(f"Expected {RATE} Hz, received {rate}")
        return Speech(samples)
