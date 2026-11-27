"""Cache verified speech by speaker identity and spoken text across renders."""
import hashlib
import json
from tempfile import NamedTemporaryFile
from pathlib import Path


def cache_key(identity, spoken):
    """Names a cue's cached clip; any change to the speaker or the spoken words renders anew."""
    return hashlib.sha256(f"{identity}:{spoken}".encode()).hexdigest()[:20]


def cue_speech(speaker, work, spoken, written, retake):
    """The cue's speech from the cache, or freshly spoken (and cached) when missing or retaken."""
    import soundfile as sf

    from narration_speech.audio import RATE
    from narration_speech.speech import Speech
    from narration_speech.transcript import mismatch

    key = cache_key(speaker.identity, spoken)
    clip, review = work / f"{key}.wav", work / f"{key}.json"
    verified = getattr(speaker, "expects_transcript", False)
    if clip.exists() and (review.exists() or not verified) and not retake:
        samples, rate = sf.read(clip, dtype="float32")
        if rate != RATE:
            raise ValueError(f"{clip}: expected {RATE} Hz, found {rate}")
        heard = json.loads(review.read_text())["heard"] if review.exists() else None
        return Speech(samples, heard, None if heard is None else mismatch(written, spoken, heard))
    speech = speaker.speak(spoken, written)
    with NamedTemporaryFile(dir=work, suffix=".wav", delete=False) as temp:
        pending = Path(temp.name)
    try:
        sf.write(pending, speech.samples, RATE, subtype="FLOAT")
        # Publish the clip last. An interrupted retake must be verified again.
        clip.unlink(missing_ok=True)
        if speech.heard is not None:
            with NamedTemporaryFile(mode="w", dir=work, delete=False) as temp:
                json.dump({"heard": speech.heard}, temp)
            Path(temp.name).replace(review)
        pending.replace(clip)
    finally:
        pending.unlink(missing_ok=True)
    return speech
