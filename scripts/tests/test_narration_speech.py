"""Tests for the narration speech tooling behind scripts/render-explainer-narration.py.

Run: uv run --no-project -p 3.12 --with pytest --with numpy --with scipy --with soundfile \
       --with pyloudnorm --with num2words pytest scripts/tests/test_narration_speech.py
Whisper and the Drama 3 model are not needed: the speaker is exercised against a
local HTTP server that answers like Drama 3, with a scripted transcriber.
"""
import base64
import io
import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

np = pytest.importorskip("numpy")
sf = pytest.importorskip("soundfile")
pytest.importorskip("scipy")
pytest.importorskip("pyloudnorm")
pytest.importorskip("num2words")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from narration_speech.audio import RATE  # noqa: E402
from narration_speech.drama3_speaker import Drama3Speaker, Drama3Voice, Take, choose_take  # noqa: E402
from narration_speech.transcript import Mismatch, mismatch  # noqa: E402
from narration_speech.voices import open_speaker  # noqa: E402


# --- Comparing a transcript with the script --------------------------------------------------

def test_a_transcript_that_spells_the_written_form_is_heard_as_written():
    assert mismatch("UML draws a class.", "U M L draws a class.", "UML draws a class.").rate == 0


def test_a_transcript_that_spells_the_spoken_form_is_heard_as_written():
    assert mismatch("Call setState now.", "Call set state now.", "Call set state now.").rate == 0


def test_numbers_and_percent_signs_match_their_spelled_out_words():
    assert mismatch("Below 15 percent.", "Below 15 percent.", "Below fifteen %.").rate == 0


@pytest.mark.parametrize("script, heard", [
    ("Hall Hopper's backlog grows.", "Hallhopper's backlog grows."),    # spacing
    ("The developers' plan.", "The developer's plan."),                 # apostrophe
    ("Both equals signs.", "Both equal signs."),                        # plural s
    ("Our file, note dot text, exists.", "Our file, note.text, exists."),  # code dot
    ("Each owes 20 dollars.", "Each owes $20."),                        # currency
    ("Ava pays 3 dollars and 34 cents.", "Ava pays $3.34."),            # currency with cents
    ("At 2:13 in the morning.", "At 2.13 in the morning."),             # clock time
])
def test_spelling_variants_of_the_same_words_are_not_slips(script, heard):
    assert mismatch(script, script, heard).rate == 0


def test_a_misheard_word_is_still_a_slip():
    script = "Hi, high, hi."
    assert mismatch(script, script, "Hi, high, high.").differences("Hi, high, high.") == ["'hi' heard as 'high'"]


def test_a_dropped_word_is_reported_by_name():
    script = "Keep that boundary clear."
    result = mismatch(script, script, "That boundary clear.")
    assert result.rate == pytest.approx(1 / 4)
    assert result.differences("That boundary clear.") == ["missing 'keep'"]


def test_a_repeated_word_is_reported_as_extra():
    script = "So name and rename appear once."
    heard = "So name and and rename appear once."
    assert mismatch(script, script, heard).differences(heard) == ["extra 'and'"]


# --- Choosing among takes -------------------------------------------------------------------

def take(length, rate):
    return Take(np.zeros(length, dtype="float32"), "", Mismatch(rate, "script"))


def test_the_take_with_fewer_word_errors_wins_even_at_an_unusual_length():
    assert len(choose_take([take(20, 0.5), take(21, 0.5), take(90, 0.25)]).samples) == 90


def test_among_equally_accurate_takes_the_length_nearest_the_median_wins():
    assert len(choose_take([take(10, 0.25), take(20, 0.25), take(90, 0.25)]).samples) == 20


# --- Speaking through a Drama 3 server --------------------------------------------------------

VOICE = Drama3Voice(name="Test voice", direction="[warm]", reference_text="A reference line.",
                    reference=b"fLaC-test-bytes", media_type="audio/flac", digest="0" * 16)


class FakeDrama3:
    """A local server that answers /v1/audio/speech like Drama 3: one WAV tone per request."""

    def __init__(self, seconds_per_take):
        self.requests, self._seconds = [], list(seconds_per_take)
        fake = self

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                fake.requests.append((self.path, json.loads(self.rfile.read(int(self.headers["Content-Length"])))))
                seconds = fake._seconds[len(fake.requests) - 1]
                tone = 0.2 * np.sin(2 * np.pi * 220 * np.arange(int(44100 * seconds)) / 44100)
                body = io.BytesIO()
                sf.write(body, tone.astype("float32"), 44100, format="WAV", subtype="PCM_16")
                self.send_response(200)
                self.send_header("Content-Type", "audio/wav")
                self.end_headers()
                self.wfile.write(body.getvalue())

            def log_message(self, *args):
                pass

        self._server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self._server.server_address[1]}"
        threading.Thread(target=self._server.serve_forever, daemon=True).start()

    def close(self):
        self._server.shutdown()


@pytest.fixture
def server_with_takes():
    servers = []

    def start(*seconds):
        servers.append(FakeDrama3(seconds))
        return servers[-1]

    yield start
    for server in servers:
        server.close()


def scripted(*transcripts):
    heard = iter(transcripts)
    return lambda samples: next(heard)


def test_each_request_carries_the_reference_clip_inline_and_starts_with_the_direction(server_with_takes):
    server = server_with_takes(1.0)
    speaker = Drama3Speaker("test", VOICE, 1, server=server.url, takes=1, transcriber=scripted("Hello."))
    speaker.speak("Hello.", "Hello.")
    path, body = server.requests[0]
    assert path == "/v1/audio/speech"
    assert body["input"] == "[warm] Hello."
    reference = body["references"][0]
    assert base64.b64decode(reference["data"]) == VOICE.reference
    assert (reference["media_type"], reference["text"]) == ("audio/flac", "A reference line.")


def test_rendering_stops_at_the_first_take_heard_exactly_as_written(server_with_takes):
    server = server_with_takes(1.0, 2.0, 3.0)
    speaker = Drama3Speaker("test", VOICE, 1, server=server.url, takes=3,
                            transcriber=scripted("That clear.", "Keep that boundary clear."))
    speech = speaker.speak("Keep that boundary clear.", "Keep that boundary clear.")
    assert len(server.requests) == 2
    assert len(speech.samples) == 2 * RATE
    assert not speech.needs_review


def test_without_a_clean_take_the_closest_take_is_kept_and_flagged(server_with_takes):
    server = server_with_takes(1.0, 2.0)
    speaker = Drama3Speaker("test", VOICE, 1, server=server.url, takes=2,
                            transcriber=scripted("That clear.", "That boundary clear."))
    speech = speaker.speak("Keep that boundary clear.", "Keep that boundary clear.")
    assert len(speech.samples) == 2 * RATE
    assert speech.needs_review and speech.heard == "That boundary clear."


# --- Resolving a narration's voice ------------------------------------------------------------

def test_a_registered_drama3_voice_refuses_a_speed_other_than_one():
    with pytest.raises(ValueError, match="no speed control"):
        open_speaker("drama3-female6", 0.95)


def test_an_unregistered_voice_is_a_kokoro_voice_that_needs_its_model_files():
    with pytest.raises(ValueError, match="requires --model and --voices"):
        open_speaker("af_heart", 0.95)
