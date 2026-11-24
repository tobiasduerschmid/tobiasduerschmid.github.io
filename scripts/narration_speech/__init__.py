"""Speech synthesis for scripts/render-explainer-narration.py.

A narration's `speech.voice` names either a registered voice (a folder under
`voices/` whose voice.json picks the engine, such as Fish Audio Drama 3) or a
Kokoro voice ID. `voices.open_speaker` returns an object with `identity` (a
string that changes whenever the produced audio would) and `speak(text)`, which
returns one cue's `Speech` at 24 kHz.
"""
