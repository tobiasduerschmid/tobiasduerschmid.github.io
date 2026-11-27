"""Fish Audio Drama 3 speech from a running sglang-omni server, cloning a registered voice.

Drama 3 takes no seed, and a take occasionally drops or repeats a word. Each cue
is therefore rendered up to `takes` times; Whisper transcribes every take, and
the closest one to the script is kept (ties: the length nearest the median).
Rendering stops early at a take Whisper hears exactly as written. The kept take
is trimmed and loudness-matched.
"""
import base64
import hashlib
import json
import statistics
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from .audio import decode, level, trim
from .speech import Speech
from .transcript import Mismatch, mismatch, transcribe

MEDIA_TYPES = {".flac": "audio/flac", ".wav": "audio/wav"}


@dataclass(frozen=True)
class Drama3Voice:
    """A cloned voice: a reference clip, its transcript, and the delivery tag every cue starts with."""
    name: str
    direction: str
    reference_text: str
    reference: bytes
    media_type: str
    digest: str  # changes whenever the voice definition or its clip changes

    @classmethod
    def load(cls, folder):
        folder = Path(folder)
        definition = (folder / "voice.json").read_bytes()
        config = json.loads(definition)
        clip = folder / config["reference_audio"]
        reference = clip.read_bytes()
        return cls(name=config["name"], direction=config["direction"],
                   reference_text=config["reference_text"], reference=reference,
                   media_type=MEDIA_TYPES[clip.suffix],
                   digest=hashlib.sha256(definition + reference).hexdigest()[:16])

    def request(self, spoken):
        """The /v1/audio/speech body that speaks `spoken` in this voice."""
        return {"input": f"{self.direction} {spoken}".strip(),
                "references": [{"data": base64.b64encode(self.reference).decode("ascii"),
                                "media_type": self.media_type, "text": self.reference_text}]}


@dataclass
class Take:
    samples: object
    heard: str
    mismatch: Mismatch


def choose_take(takes):
    """The take closest to the script; among equally close takes, the length nearest the median."""
    median = statistics.median(len(take.samples) for take in takes)
    return min(takes, key=lambda take: (take.mismatch.rate, abs(len(take.samples) - median)))


class Drama3Speaker:
    expects_transcript = True

    def __init__(self, voice_id, voice, speed, *, server, takes, transcriber=transcribe):
        if speed != 1:
            raise ValueError(f"Drama 3 has no speed control; set speech.speed to 1 for {voice_id}")
        if takes < 1:
            raise ValueError("--takes must be at least 1")
        self._voice, self._takes, self._transcribe = voice, takes, transcriber
        self._url = server.rstrip("/") + "/v1/audio/speech"
        self.identity = f"{voice_id}:{voice.digest}"
        self.name = voice.name

    def speak(self, spoken, written):
        takes = []
        for _ in range(self._takes):
            samples = trim(decode(self._synthesize(spoken)))
            heard = self._transcribe(samples)
            takes.append(Take(samples, heard, mismatch(written, spoken, heard)))
            if takes[-1].mismatch.rate == 0:
                break
        best = choose_take(takes)
        return Speech(level(best.samples), best.heard, best.mismatch)

    def _synthesize(self, spoken):
        body = json.dumps(self._voice.request(spoken)).encode()
        request = urllib.request.Request(self._url, data=body, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=600) as response:
                data = response.read()
        except urllib.error.HTTPError as error:
            raise RuntimeError(f"Drama 3 refused the request ({error.code}): {error.read()[:500]!r}") from error
        except urllib.error.URLError as error:
            raise RuntimeError(f"No Drama 3 server at {self._url} ({error.reason}). Start "
                               "scripts/narration_speech/drama3-serve.sh on the GPU host and "
                               "forward its port; see docs/narration-format.md.") from error
        if data[:4] != b"RIFF":
            raise RuntimeError(f"Drama 3 answered with something other than WAV audio: {data[:200]!r}")
        return data
