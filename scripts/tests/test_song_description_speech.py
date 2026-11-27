"""Exercise resumable song description rendering without a speech model."""
import importlib.util
import io
import json
import sys
from pathlib import Path

import pytest

np = pytest.importorskip("numpy")
sf = pytest.importorskip("soundfile")
pytest.importorskip("scipy")
pytest.importorskip("num2words")

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
from narration_speech.audio import RATE
from narration_speech.cache import cue_speech
from narration_speech.speech import Speech
from narration_speech.transcript import mismatch


class ScriptedSpeaker:
    expects_transcript = True

    def __init__(self, identity, takes):
        self.identity = identity
        self.takes = iter(takes)

    def speak(self, spoken, written):
        seconds, amplitude, heard = next(self.takes)
        samples = np.full(round(RATE * seconds), amplitude, dtype="float32")
        return Speech(samples, heard, mismatch(written, spoken, heard))


def test_reusing_a_take_preserves_audio_and_transcript_review(tmp_path):
    speaker = ScriptedSpeaker("first voice", [(1, 0.25, "Read.")])
    first = cue_speech(speaker, tmp_path, "Read on.", "Read on.", False)
    replay = cue_speech(speaker, tmp_path, "Read on.", "Read on.", False)
    np.testing.assert_array_equal(replay.samples, first.samples)
    assert replay.heard == "Read."
    assert replay.needs_review


def test_new_words_and_changed_voice_each_require_a_new_take(tmp_path):
    first = ScriptedSpeaker("first voice", [(1, 0.125, "One."), (1, 0.25, "Two.")])
    second = ScriptedSpeaker("second voice", [(1, 0.5, "Two.")])
    for speaker, text, amplitude in [(first, "One.", 0.125), (first, "Two.", 0.25), (second, "Two.", 0.5)]:
        rendered = cue_speech(speaker, tmp_path, text, text, False)
        assert rendered.heard == text
        np.testing.assert_array_equal(rendered.samples, np.full(RATE, amplitude))


def test_an_interrupted_verified_take_without_its_transcript_is_spoken_again(tmp_path):
    speaker = ScriptedSpeaker("verified voice", [(1, 0.125, "Stop."), (1, 0.5, "Stop here.")])
    cue_speech(speaker, tmp_path, "Stop here.", "Stop here.", False)
    next(tmp_path.glob("*.json")).unlink()

    recovered = cue_speech(speaker, tmp_path, "Stop here.", "Stop here.", False)

    assert recovered.heard == "Stop here."
    assert not recovered.needs_review
    np.testing.assert_array_equal(recovered.samples, np.full(RATE, 0.5))


@pytest.fixture
def render_song(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location("song_speech", SCRIPTS / "song-video/speak-descriptions.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    sections = [{"id": "intro", "sentences": [
        {"written": "First.", "spoken": "First."}, {"written": "Second.", "spoken": "Second."},
    ]}]

    def render(speaker, mix_rate, **options):
        monkeypatch.setattr(module, "open_speaker", lambda voice, speed: speaker)
        request = {"voice": speaker.identity, "sections": sections, **options}
        monkeypatch.setattr(sys, "stdin", io.StringIO(json.dumps(request)))
        module.main(tmp_path, mix_rate)

    return render


def test_song_wav_and_sentence_times_follow_the_verified_audio_at_the_mix_rate(tmp_path, render_song):
    speaker = ScriptedSpeaker("new voice", [(0.25, 0.25, "First."), (0.75, -0.25, "Second.")])
    mix_rate = 48000
    # An indexed WAV from the previous narrator may already occupy the output.
    output = tmp_path / "narration-0.wav"
    sf.write(output, np.zeros(mix_rate), mix_rate)

    render_song(speaker, mix_rate)

    samples, rate = sf.read(output)
    assert rate == mix_rate
    assert len(samples) == round(1.2 * mix_rate)
    assert samples[round(0.1 * rate)] == pytest.approx(0.25, abs=0.001)
    assert samples[round(0.35 * rate)] == 0
    assert samples[round(0.9 * rate)] == pytest.approx(-0.25, abs=0.001)
    timing = json.loads((tmp_path / "narration-timing.json").read_text())
    assert timing == [[{"start": 0, "end": 0.25}, {"start": 0.45, "end": 1.2}]]


def test_retaking_one_sentence_reuses_the_other_and_updates_audio_and_timings(tmp_path, render_song):
    speaker = ScriptedSpeaker("voice", [(1, 0.125, "First."), (1, 0.25, "Second."), (2, 0.5, "Second.")])
    output = tmp_path / "narration-0.wav"
    render_song(speaker, RATE)
    original, _ = sf.read(output)

    render_song(speaker, RATE, retakes=["intro/2"])

    revised, _ = sf.read(output)
    np.testing.assert_array_equal(revised[:RATE], original[:RATE])
    assert len(revised) == round(RATE * 3.2)
    assert revised[-1] == 0.5
    times = json.loads((tmp_path / "narration-timing.json").read_text())
    assert times[0][1] == {"start": 1.2, "end": 3.2}


@pytest.mark.parametrize("unknown", ["intro/0", "intro/3", "intro/1.5", "missing/1"])
def test_an_invalid_retake_is_rejected_before_rendering_any_sentence(render_song, unknown):
    speaker = ScriptedSpeaker("voice", [])
    with pytest.raises(ValueError, match=unknown):
        render_song(speaker, RATE, retakes=["intro/1", unknown])


def test_a_retake_applies_only_to_its_occurrence_on_subsequent_renders(tmp_path, render_song):
    speaker = ScriptedSpeaker("voice", [(1, 0.125, "Repeat."), (1, 0.5, "Repeat.")])
    sentence = {"written": "Repeat.", "spoken": "Repeat."}
    sections = [{"id": "echo", "sentences": [sentence, sentence, sentence]}]
    render_song(speaker, RATE, sections=sections)
    render_song(speaker, RATE, sections=sections, retakes=["echo/2"])
    output = tmp_path / "narration-0.wav"
    revised, _ = sf.read(output)
    for seconds, amplitude in [(0.5, 0.125), (1.7, 0.5), (2.9, 0.125)]:
        assert revised[round(seconds * RATE)] == amplitude

    render_song(speaker, RATE, sections=sections)

    replay, _ = sf.read(output)
    np.testing.assert_array_equal(replay, revised)


@pytest.fixture
def music_gain():
    pytest.importorskip("pyloudnorm")
    spec = importlib.util.spec_from_file_location("measure_music", SCRIPTS / "song-video/measure-music.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.description_music_gain


@pytest.mark.parametrize("format", ["mono", "one-channel WAV", "stereo"])
def test_loud_music_sits_three_loudness_units_above_the_stereo_voice_without_clipping(music_gain, format):
    import pyloudnorm as pyln
    from narration_speech.audio import TARGET_LUFS

    wave = np.sin(2 * np.pi * 440 * np.arange(RATE) / RATE)
    music = {"mono": wave, "one-channel WAV": wave[:, None], "stereo": np.column_stack([wave, wave * 0.5])}[format]
    meter = pyln.Meter(RATE)
    measured_voice = pyln.normalize.loudness(wave, meter.integrated_loudness(wave), TARGET_LUFS)
    reference = meter.integrated_loudness(np.column_stack([measured_voice, measured_voice]))

    gain = music_gain(music, RATE)

    assert 0 < gain < 1
    output = (music if format == "stereo" else np.column_stack([wave, wave])) * gain
    assert meter.integrated_loudness(output) - reference == pytest.approx(3, abs=0.1)
    assert np.abs(output).max() < 1


@pytest.mark.parametrize("amplitude", [0.0, 0.01], ids=["silent", "quiet"])
def test_balancing_leaves_quiet_or_silent_music_at_its_original_level(music_gain, amplitude):
    music = amplitude * np.sin(2 * np.pi * 440 * np.arange(RATE) / RATE)
    assert music_gain(music, RATE) == 1
