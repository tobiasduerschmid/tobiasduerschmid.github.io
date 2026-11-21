"""Compare what a listener hears in a take with what the script says.

A cue's written text ("UML", "setState", "15 percent") and its spoken form
("U M L", "set state") can each match a correct transcript better, because the
transcriber spells some words one way and some the other. `mismatch` therefore
scores the transcript against both and keeps the closer one. Edits that only
move spaces or apostrophes or add a plural "s" ("hall hopper's" heard as
"hallhoppers") are spelling, not slips, and do not count. What remains is
mostly dropped, repeated, or misheard words.
"""
import difflib
import re
from dataclasses import dataclass

WHISPER = "mlx-community/whisper-large-v3-turbo"


def words(text):
    """Lower-case words with numbers spelled out, so "15%" and "fifteen percent" agree."""
    from num2words import num2words

    text = text.lower().replace("%", " percent").replace("-", " ").replace("’", "'")
    text = re.sub(r"\$(\d+)(?:\.(\d\d))?",  # "$3.34" is "3 dollars and 34 cents"
                  lambda match: f"{match.group(1)} dollars" + (f" and {match.group(2)} cents" if match.group(2) else ""),
                  text)
    text = re.sub(r"(?<=[a-z])(\.+)(?=[a-z])", lambda match: " dot " * len(match.group(1)), text)  # fs.readFile
    text = re.sub(r"(\d+)[:.](\d+)", r"\1 \2", text)  # clock times, spoken "two thirteen"
    text = re.sub(r"\d+", lambda match: " " + num2words(int(match.group())) + " ", text)
    text = text.replace("-", " ")
    return re.sub(r"[^a-z' ]+", " ", text).split()


def _spelling(phrase):
    return re.sub(r"[\s']", "", phrase).rstrip("s")


def slips(reference, heard):
    """Edits from the reference words to the heard words, ignoring spelling-only differences.

    Each edit is (kind, said, heard_as, size): kind is "missing", "extra" or "misheard",
    and size counts the words it affects.
    """
    expected, actual = words(reference), words(heard)
    found = []
    matcher = difflib.SequenceMatcher(None, expected, actual, autojunk=False)
    for kind, i1, i2, j1, j2 in matcher.get_opcodes():
        said, got = " ".join(expected[i1:i2]), " ".join(actual[j1:j2])
        if kind == "equal" or (kind == "replace" and _spelling(said) == _spelling(got)):
            continue
        name = {"delete": "missing", "insert": "extra", "replace": "misheard"}[kind]
        found.append((name, said, got, max(i2 - i1, j2 - j1)))
    return found


@dataclass(frozen=True)
class Mismatch:
    rate: float      # words affected by slips, per word of the closer form
    reference: str   # the closer of the cue's written and spoken forms

    def differences(self, heard):
        """Readable slips, e.g. ["missing 'keep'", "'hi' heard as 'high'"]."""
        labels = {"missing": "missing '{0}'", "extra": "extra '{1}'", "misheard": "'{0}' heard as '{1}'"}
        return [labels[kind].format(said, got) for kind, said, got, _ in slips(self.reference, heard)]


def mismatch(written, spoken, heard):
    """Score `heard` against whichever of the cue's written or spoken form it matches better."""
    def score(form):
        return Mismatch(sum(size for *_, size in slips(form, heard)) / max(1, len(words(form))), form)

    return min((score(form) for form in (written, spoken)), key=lambda candidate: candidate.rate)


def transcribe(samples):
    """Transcribe 24 kHz float32 mono samples with Whisper on Apple silicon (mlx-whisper)."""
    import mlx_whisper
    from scipy.signal import resample_poly

    sixteen = resample_poly(samples, 2, 3).astype("float32")  # Whisper listens at 16 kHz
    result = mlx_whisper.transcribe(sixteen, path_or_hf_repo=WHISPER, language="en",
                                    temperature=0.0, condition_on_previous_text=False)
    return result["text"].strip()
