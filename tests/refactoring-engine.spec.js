// @ts-check
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..');
const analyzerPath = path.join(repoRoot, 'js', 'python-ast-analyzer.py');
const enginePath = path.join(repoRoot, 'js', 'tutorial-refactorings.js');

function text(strings, ...values) {
  const raw = String.raw({ raw: strings }, ...values);
  return raw.replace(/^\n/, '').replace(/\n$/, '');
}

function loadRefactoringTestApi() {
  const source = fs.readFileSync(enginePath, 'utf8');
  const sandbox = { window: {}, console };
  vm.runInNewContext(source, sandbox, { filename: enginePath });
  return sandbox.window.SebookRefactorings._test;
}

function loadPythonAdapter() {
  return loadRefactoringTestApi().PythonAdapter;
}

function workspaceFrom(files, activeFile) {
  return {
    activeFile,
    files: Object.entries(files).map(([filename, content]) => ({
      filename,
      content,
      language: 'python',
    })),
  };
}

function analyze(workspace) {
  const raw = execFileSync('python3', [analyzerPath], {
    input: JSON.stringify(workspace.files),
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const result = JSON.parse(raw);
  if (result.errors && result.errors.length) {
    throw new Error(JSON.stringify(result.errors));
  }
  return result;
}

function positionOn(content, needle) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const col = lines[i].indexOf(needle);
    if (col !== -1) return { lineNumber: i + 1, column: col + 1 };
  }
  throw new Error(`Could not find ${needle}`);
}

function rangeForNeedle(content, needle) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const col = lines[i].indexOf(needle);
    if (col !== -1) {
      return {
        lineNumber: i + 1,
        column: col + 1,
        endColumn: col + needle.length + 1,
      };
    }
  }
  throw new Error(`Could not find ${needle}`);
}

function selectionBetween(content, startNeedle, endNeedle) {
  const start = rangeForNeedle(content, startNeedle);
  const end = rangeForNeedle(content, endNeedle);
  return {
    startLineNumber: start.lineNumber,
    startColumn: start.column,
    endLineNumber: end.lineNumber,
    endColumn: end.endColumn,
    isEmpty() {
      return this.startLineNumber === this.endLineNumber && this.startColumn === this.endColumn;
    },
  };
}

function selectionAt(content, needle) {
  return selectionBetween(content, needle, needle);
}

function offsetAt(content, lineNumber, column) {
  const lines = content.split('\n');
  let offset = 0;
  for (let i = 0; i < lineNumber - 1; i++) offset += lines[i].length + 1;
  return offset + column - 1;
}

function applyPlan(workspace, plan) {
  const files = Object.fromEntries(workspace.files.map((file) => [file.filename, file.content]));
  const edits = [...(plan.edits || [])].sort((a, b) => {
    if (a.filename !== b.filename) return a.filename < b.filename ? -1 : 1;
    if (a.range.startLineNumber !== b.range.startLineNumber) {
      return b.range.startLineNumber - a.range.startLineNumber;
    }
    return b.range.startColumn - a.range.startColumn;
  });
  for (const edit of edits) {
    const content = files[edit.filename];
    const start = offsetAt(content, edit.range.startLineNumber, edit.range.startColumn);
    const end = offsetAt(content, edit.range.endLineNumber, edit.range.endColumn);
    files[edit.filename] = content.slice(0, start) + edit.text + content.slice(end);
  }
  return files;
}

function contrastRatio(foreground, background) {
  function channel(value) {
    value /= 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  }
  function luminance(hex) {
    const raw = hex.replace('#', '');
    const rgb = [0, 2, 4].map((idx) => parseInt(raw.slice(idx, idx + 2), 16));
    const [r, g, b] = rgb.map(channel);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test.describe('tutorial refactoring engine', () => {
  const api = loadRefactoringTestApi();
  const adapter = api.PythonAdapter;

  test('renames a local symbol without touching strings, comments, or other scopes', () => {
    const before = text`
def build_summary(track):
    score = track.duration_sec + 10
    label = "score should remain literal"
    # score should remain comment
    return score + len(label)

def audit(score):
    return score
`;
    const workspace = workspaceFrom({ 'playlist.py': before }, 'playlist.py');
    const analysis = analyze(workspace);
    const plan = adapter.planRename(
      workspace,
      analysis,
      'playlist.py',
      positionOn(before, 'score + len'),
      'score',
      'rating'
    );
    expect(plan.error).toBeFalsy();
    expect(applyPlan(workspace, plan)['playlist.py']).toBe(text`
def build_summary(track):
    rating = track.duration_sec + 10
    label = "score should remain literal"
    # score should remain comment
    return rating + len(label)

def audit(score):
    return score
`);
  });

  test('renames self attributes only within the owning class', () => {
    const before = text`
class Track:
    def __init__(self, duration_sec):
        self.duration_sec = duration_sec

    def label(self):
        return self.duration_sec

class AdBreak:
    def __init__(self, duration_sec):
        self.duration_sec = duration_sec
`;
    const workspace = workspaceFrom({ 'models.py': before }, 'models.py');
    const analysis = analyze(workspace);
    const plan = adapter.planRename(
      workspace,
      analysis,
      'models.py',
      positionOn(before, 'self.duration_sec = duration_sec'),
      'duration_sec',
      'length_seconds'
    );
    expect(plan.error).toBeFalsy();
    expect(applyPlan(workspace, plan)['models.py']).toBe(text`
class Track:
    def __init__(self, duration_sec):
        self.length_seconds = duration_sec

    def label(self):
        return self.length_seconds

class AdBreak:
    def __init__(self, duration_sec):
        self.duration_sec = duration_sec
`);
  });

  test('renames a module-level symbol only in the active file', () => {
    const pricing = text`
TAX_RATE = 0.08

def total(subtotal):
    return subtotal + subtotal * TAX_RATE
`;
    const config = text`
TAX_RATE = 0.20

def show():
    return TAX_RATE
`;
    const workspace = workspaceFrom({ 'pricing.py': pricing, 'config.py': config }, 'pricing.py');
    const analysis = analyze(workspace);
    const plan = adapter.planRename(
      workspace,
      analysis,
      'pricing.py',
      positionOn(pricing, 'TAX_RATE = 0.08'),
      'TAX_RATE',
      'SALES_TAX_RATE'
    );
    expect(plan.error).toBeFalsy();
    const applied = applyPlan(workspace, plan);
    expect(applied['pricing.py']).toBe(text`
SALES_TAX_RATE = 0.08

def total(subtotal):
    return subtotal + subtotal * SALES_TAX_RATE
`);
    expect(applied['config.py']).toBe(config);
  });

  test('refuses a local rename that would shadow an existing binding in the same function', () => {
    const before = text`
def build_summary(track):
    score = track.duration_sec + 10
    label = "ready"
    return score, label
`;
    const workspace = workspaceFrom({ 'playlist.py': before }, 'playlist.py');
    const analysis = analyze(workspace);
    const plan = adapter.planRename(
      workspace,
      analysis,
      'playlist.py',
      positionOn(before, 'score ='),
      'score',
      'label'
    );
    expect(plan.error).toContain('collide');
  });

  test('renames top-level function parameters and keyword call sites across listed files', () => {
    const tracks = text`
def add_track(title, artist):
    return f"{title}:{artist}"
`;
    const app = text`
from tracks import add_track

created = add_track(title="Pulse", artist="Ava")
`;
    const workspace = workspaceFrom({ 'tracks.py': tracks, 'app.py': app }, 'tracks.py');
    const analysis = analyze(workspace);
    const plan = adapter.planRename(
      workspace,
      analysis,
      'tracks.py',
      positionOn(tracks, 'artist):'),
      'artist',
      'creator'
    );
    expect(plan.error).toBeFalsy();
    const applied = applyPlan(workspace, plan);
    expect(applied['tracks.py']).toBe(text`
def add_track(title, creator):
    return f"{title}:{creator}"
`);
    expect(applied['app.py']).toBe(text`
from tracks import add_track

created = add_track(title="Pulse", creator="Ava")
`);
  });

  test('extracts a parameterized method and returns assigned output used later', () => {
    const before = text`
class Playlist:
    def summarize(self, track, tax_rate):
        base = track.duration_sec / 60
        bonus = 2
        score = base + bonus
        total = score * tax_rate
        return total
`;
    const workspace = workspaceFrom({ 'playlist.py': before }, 'playlist.py');
    const analysis = analyze(workspace);
    const plan = adapter.planExtract(
      workspace,
      analysis,
      'playlist.py',
      selectionBetween(before, 'score = base + bonus', 'total = score * tax_rate'),
      'compute_total'
    );
    expect(plan.error).toBeFalsy();
    expect(applyPlan(workspace, plan)['playlist.py']).toBe(text`
class Playlist:
    def summarize(self, track, tax_rate):
        base = track.duration_sec / 60
        bonus = 2
        total = self.compute_total(base, bonus, tax_rate)
        return total

    def compute_total(self, base, bonus, tax_rate):
        score = base + bonus
        total = score * tax_rate
        return total
`);
  });

  test('extracts multiple outputs while ignoring nested function locals', () => {
    const before = text`
def summarize(track, tax_rate):
    base = track.duration_sec / 60
    bonus = 2
    def nested():
        subtotal = 999
        return subtotal
    subtotal = base + bonus
    total = subtotal * tax_rate
    return subtotal, total, nested()
`;
    const workspace = workspaceFrom({ 'playlist.py': before }, 'playlist.py');
    const analysis = analyze(workspace);
    const plan = adapter.planExtract(
      workspace,
      analysis,
      'playlist.py',
      selectionBetween(before, 'subtotal = base + bonus', 'total = subtotal * tax_rate'),
      'compute_totals'
    );
    expect(plan.error).toBeFalsy();
    expect(applyPlan(workspace, plan)['playlist.py']).toBe(text`
def summarize(track, tax_rate):
    base = track.duration_sec / 60
    bonus = 2
    def nested():
        subtotal = 999
        return subtotal
    subtotal, total = compute_totals(base, bonus, tax_rate)
    return subtotal, total, nested()

def compute_totals(base, bonus, tax_rate):
    subtotal = base + bonus
    total = subtotal * tax_rate
    return subtotal, total
`);
  });

  test('extracts guard clauses that raise exceptions', () => {
    const before = text`
def play_track(user, track):
    if user.region not in track.available_regions:
        raise PermissionError(f"Track not available in {user.region}")
    royalty = track.rate * 0.7
    return royalty
`;
    const workspace = workspaceFrom({ 'player.py': before }, 'player.py');
    const analysis = analyze(workspace);
    const selection = selectionBetween(
      before,
      'if user.region not in track.available_regions:',
      'raise PermissionError(f"Track not available in {user.region}")'
    );
    expect(api.computePythonActionAvailability(
      workspace,
      analysis,
      'player.py',
      positionOn(before, 'if user.region'),
      selection,
      null
    )).toMatchObject({ extract: true });
    const plan = adapter.planExtract(
      workspace,
      analysis,
      'player.py',
      selection,
      'ensure_track_available'
    );
    expect(plan.error).toBeFalsy();
    expect(applyPlan(workspace, plan)['player.py']).toBe(text`
def play_track(user, track):
    ensure_track_available(user, track)
    royalty = track.rate * 0.7
    return royalty

def ensure_track_available(user, track) -> None:
    if user.region not in track.available_regions:
        raise PermissionError(f"Track not available in {user.region}")
`);
  });

  test('only offers extract for a precise complete-statement selection', () => {
    const before = text`
class Playlist:
    def summarize(self, track, tax_rate):
        base = track.duration_sec / 60
        bonus = 2
        score = base + bonus
        total = score * tax_rate
        return total
`;
    const selection = selectionBetween(before, 'score = base + bonus', 'total = score * tax_rate');
    const workspace = workspaceFrom({ 'playlist.py': before }, 'playlist.py');
    const analysis = analyze(workspace);
    expect(api.computePythonActionAvailability(
      workspace,
      analysis,
      'playlist.py',
      positionOn(before, 'score ='),
      selection,
      null
    )).toMatchObject({
      rename: false,
      extract: true,
      parameterObject: false,
      moveMethod: false,
      moveField: false,
    });
  });

  test('does not extract partial expressions or indentation-only selections', () => {
    const before = text`
def summarize(track, tax_rate):
    base = track.duration_sec / 60
    bonus = 2
    score = base + bonus
    total = score * tax_rate
    return total
`;
    const workspace = workspaceFrom({ 'playlist.py': before }, 'playlist.py');
    const analysis = analyze(workspace);
    const expressionSelection = selectionAt(before, 'base + bonus');
    const expressionPlan = adapter.planExtract(
      workspace,
      analysis,
      'playlist.py',
      expressionSelection,
      'compute_score'
    );
    expect(expressionPlan.error).toBeTruthy();
    expect(api.computePythonActionAvailability(
      workspace,
      analysis,
      'playlist.py',
      positionOn(before, 'base + bonus'),
      expressionSelection,
      null
    )).toMatchObject({ extract: false });

    const scoreLine = rangeForNeedle(before, 'score = base + bonus').lineNumber;
    const indentationSelection = {
      startLineNumber: scoreLine,
      startColumn: 1,
      endLineNumber: scoreLine,
      endColumn: 5,
      isEmpty() { return false; },
    };
    const indentationPlan = adapter.planExtract(
      workspace,
      analysis,
      'playlist.py',
      indentationSelection,
      'compute_score'
    );
    expect(indentationPlan.error).toBeTruthy();
    expect(api.computePythonActionAvailability(
      workspace,
      analysis,
      'playlist.py',
      { lineNumber: scoreLine, column: 1 },
      indentationSelection,
      null
    )).toMatchObject({ extract: false });
  });

  test('refuses extraction across async and scope-sensitive statement boundaries', () => {
    const asyncSource = text`
async def load_track(client):
    response = await client.fetch()
    payload = response.json()
    return payload
`;
    const asyncWorkspace = workspaceFrom({ 'client.py': asyncSource }, 'client.py');
    const asyncAnalysis = analyze(asyncWorkspace);
    const asyncPlan = adapter.planExtract(
      asyncWorkspace,
      asyncAnalysis,
      'client.py',
      selectionBetween(asyncSource, 'response = await client.fetch()', 'payload = response.json()'),
      'read_payload'
    );
    expect(asyncPlan.error).toContain('Async');

    const globalSource = text`
count = 0

def bump():
    global count
    count += 1
    return count
`;
    const globalWorkspace = workspaceFrom({ 'counter.py': globalSource }, 'counter.py');
    const globalAnalysis = analyze(globalWorkspace);
    const globalPlan = adapter.planExtract(
      globalWorkspace,
      globalAnalysis,
      'counter.py',
      selectionBetween(globalSource, 'global count', 'count += 1'),
      'increment'
    );
    expect(globalPlan.error).toBeTruthy();

    const trySource = text`
def parse(raw):
    try:
        return int(raw)
    except ValueError:
        return 0
`;
    const tryWorkspace = workspaceFrom({ 'parse.py': trySource }, 'parse.py');
    const tryAnalysis = analyze(tryWorkspace);
    const tryPlan = adapter.planExtract(
      tryWorkspace,
      tryAnalysis,
      'parse.py',
      selectionBetween(trySource, 'try:', 'return 0'),
      'parse_int'
    );
    expect(tryPlan.error).toBeTruthy();
  });

  test('refuses extraction when the helper name already exists in the target scope', () => {
    const before = text`
def summarize(track):
    score = track.duration_sec + 10
    return score

def compute_score(track):
    return 0
`;
    const workspace = workspaceFrom({ 'playlist.py': before }, 'playlist.py');
    const analysis = analyze(workspace);
    const plan = adapter.planExtract(
      workspace,
      analysis,
      'playlist.py',
      selectionAt(before, 'score = track.duration_sec + 10'),
      'compute_score'
    );
    expect(plan.error).toContain('already exists');
  });

  test('offers parameter object for a selected long parameter list in a function signature', () => {
    const before = text`
"""The track catalog: add a new track to the library."""
from typing import Dict, List


# The library is a list of dicts. Pretend this is a database.
LIBRARY: List[Dict] = []


def add_track(title, artist, album, duration_sec, genre, release_year, bpm, isrc):
    """Insert a new track into the library."""
    record = {
        "title": title,
        "artist": artist,
        "album": album,
        "duration_sec": duration_sec,
        "genre": genre,
        "release_year": release_year,
        "bpm": bpm,
        "isrc": isrc,
    }
    LIBRARY.append(record)
    return record
`;
    const workspace = workspaceFrom({ 'catalog.py': before }, 'catalog.py');
    const analysis = analyze(workspace);
    const selection = selectionBetween(
      before,
      'title, artist, album',
      'release_year, bpm, isrc'
    );
    expect(api.computePythonActionAvailability(
      workspace,
      analysis,
      'catalog.py',
      positionOn(before, 'artist'),
      selection,
      null
    )).toMatchObject({
      rename: false,
      extract: false,
      parameterObject: true,
      moveMethod: false,
      moveField: false,
    });

    const plan = adapter.planParameterObject(
      workspace,
      analysis,
      'catalog.py',
      positionOn(before, 'def add_track'),
      'TrackInfo',
      ['artist', 'album', 'duration_sec', 'genre', 'release_year', 'bpm', 'isrc']
    );
    expect(plan.error).toBeFalsy();
    expect(applyPlan(workspace, plan)['catalog.py']).toContain(
      'def add_track(title, track_info: TrackInfo):'
    );
  });

  test('introduces a parameter object and rewrites positional and keyword call sites across files', () => {
    const tracks = text`
from __future__ import annotations

def add_track(title: str, artist: str, album: str, duration_sec: int, genre: str, release_year: int, bpm: int, isrc: str):
    label = f"{artist} / {album}"
    return {
        "title": title,
        "label": label,
        "genre": genre,
        "release_year": release_year,
        "duration": duration_sec,
        "bpm": bpm,
        "isrc": isrc,
    }
`;
    const app = text`
from tracks import add_track

first = add_track("Pulse", "Ava", "Night", 180, "pop", 2021, 124, "ISRC1")
second = add_track(
    title="Flow", artist="Ben", album="Day", duration_sec=210,
    genre="jazz", release_year=2020, bpm=95, isrc="ISRC2"
)
`;
    const workspace = workspaceFrom({ 'tracks.py': tracks, 'app.py': app }, 'tracks.py');
    const analysis = analyze(workspace);
    const plan = adapter.planParameterObject(
      workspace,
      analysis,
      'tracks.py',
      positionOn(tracks, 'label ='),
      'AlbumInfo',
      ['artist', 'album', 'genre', 'release_year']
    );
    expect(plan.error).toBeFalsy();
    const applied = applyPlan(workspace, plan);
    expect(applied['tracks.py']).toBe(text`
from __future__ import annotations
from dataclasses import dataclass

@dataclass
class AlbumInfo:
    artist: str
    album: str
    genre: str
    release_year: int

def add_track(title: str, album_info: AlbumInfo, duration_sec: int, bpm: int, isrc: str):
    label = f"{album_info.artist} / {album_info.album}"
    return {
        "title": title,
        "label": label,
        "genre": album_info.genre,
        "release_year": album_info.release_year,
        "duration": duration_sec,
        "bpm": bpm,
        "isrc": isrc,
    }
`);
    expect(applied['app.py']).toBe(text`
from tracks import add_track, AlbumInfo

first = add_track("Pulse", AlbumInfo("Ava", "Night", "pop", 2021), 180, 124, "ISRC1")
second = add_track(title="Flow", album_info=AlbumInfo(artist="Ben", album="Day", genre="jazz", release_year=2020), duration_sec=210, bpm=95, isrc="ISRC2")
`);
  });

  test('introduce parameter object rewrites multi-line method signatures', () => {
    const before = text`
"""The track catalog: add a new track to the library."""
from typing import Dict, List


class TrackCatalog:
    """Stores and inserts tracks. Pretend the library list is a database."""

    def __init__(self) -> None:
        self.library: List[Dict] = []

    def add_track(
        self,
        title: str,
        artist: str,
        album: str,
        duration_sec: int,
        genre: str,
        release_year: int,
        bpm: int,
        isrc: str,
    ) -> Dict:
        """Insert a new track into the library."""
        record: Dict = {
            "title": title,
            "artist": artist,
            "album": album,
            "duration_sec": duration_sec,
            "genre": genre,
            "release_year": release_year,
            "bpm": bpm,
            "isrc": isrc,
        }
        self.library.append(record)
        return record
`;
    const workspace = workspaceFrom({ 'catalog.py': before }, 'catalog.py');
    const analysis = analyze(workspace);
    const selection = selectionBetween(before, 'title: str', 'isrc: str');
    expect(api.computePythonActionAvailability(
      workspace,
      analysis,
      'catalog.py',
      positionOn(before, 'title: str'),
      selection,
      null
    )).toMatchObject({ parameterObject: true });
    const plan = adapter.planParameterObject(
      workspace,
      analysis,
      'catalog.py',
      positionOn(before, 'def add_track'),
      'TrackInfo',
      ['title', 'artist', 'album', 'duration_sec', 'genre', 'release_year', 'bpm', 'isrc']
    );
    expect(plan.error).toBeFalsy();
    expect(applyPlan(workspace, plan)['catalog.py']).toBe(text`
"""The track catalog: add a new track to the library."""
from dataclasses import dataclass
from typing import Dict, List


@dataclass
class TrackInfo:
    title: str
    artist: str
    album: str
    duration_sec: int
    genre: str
    release_year: int
    bpm: int
    isrc: str

class TrackCatalog:
    """Stores and inserts tracks. Pretend the library list is a database."""

    def __init__(self) -> None:
        self.library: List[Dict] = []

    def add_track(
        self,
        track_info: TrackInfo,
    ) -> Dict:
        """Insert a new track into the library."""
        record: Dict = {
            "title": track_info.title,
            "artist": track_info.artist,
            "album": track_info.album,
            "duration_sec": track_info.duration_sec,
            "genre": track_info.genre,
            "release_year": track_info.release_year,
            "bpm": track_info.bpm,
            "isrc": track_info.isrc,
        }
        self.library.append(record)
        return record
`);
  });

  test('introduce parameter object rewrites method calls in test files with constructed receivers', () => {
    const catalog = text`
from typing import Dict, List

class TrackCatalog:
    def __init__(self) -> None:
        self.library: List[Dict] = []

    def add_track(
        self,
        title: str,
        artist: str,
        album: str,
        duration_sec: int,
        genre: str,
        release_year: int,
        bpm: int,
        isrc: str,
    ) -> Dict:
        record: Dict = {
            "title": title,
            "artist": artist,
            "album": album,
            "duration_sec": duration_sec,
            "genre": genre,
            "release_year": release_year,
            "bpm": bpm,
            "isrc": isrc,
        }
        self.library.append(record)
        return record
`;
    const testCatalog = text`
from catalog import TrackCatalog

def test_add_track_inserts_record():
    catalog = TrackCatalog()
    record = catalog.add_track("Pulse", "Ava", "Night", 180, "pop", 2021, 124, "ISRC1")
    assert record["artist"] == "Ava"
`;
    const workspace = workspaceFrom({ 'catalog.py': catalog, 'test_catalog.py': testCatalog }, 'catalog.py');
    const analysis = analyze(workspace);
    const plan = adapter.planParameterObject(
      workspace,
      analysis,
      'catalog.py',
      positionOn(catalog, 'def add_track'),
      'TrackInfo',
      ['title', 'artist', 'album', 'duration_sec', 'genre', 'release_year', 'bpm', 'isrc']
    );
    expect(plan.error).toBeFalsy();
    expect(plan.edits.map((edit) => edit.filename)).toContain('test_catalog.py');
    const previewRows = api.buildPreviewFileHunks('test_catalog.py', plan.edits, workspace, 2)
      .flatMap((hunk) => hunk.rows.map((row) => [row.kind, row.text]));
    expect(previewRows).toContainEqual([
      'new',
      'from catalog import TrackCatalog, TrackInfo',
    ]);
    expect(previewRows).toContainEqual([
      'new',
      '    record = catalog.add_track(TrackInfo("Pulse", "Ava", "Night", 180, "pop", 2021, 124, "ISRC1"))',
    ]);
    expect(applyPlan(workspace, plan)['test_catalog.py']).toBe(text`
from catalog import TrackCatalog, TrackInfo

def test_add_track_inserts_record():
    catalog = TrackCatalog()
    record = catalog.add_track(TrackInfo("Pulse", "Ava", "Night", 180, "pop", 2021, 124, "ISRC1"))
    assert record["artist"] == "Ava"
`);
  });

  test('introduce parameter object rewrites inline constructors, fixtures, and factory receivers in tests', () => {
    const catalog = text`
class TrackCatalog:
    def add_track(self, title: str, artist: str, album: str, duration_sec: int):
        return title, artist, album, duration_sec
`;
    const tests = text`
from catalog import TrackCatalog as Catalog

def catalog() -> Catalog:
    return Catalog()

def make_catalog() -> Catalog:
    return Catalog()

def test_inline_receiver():
    assert Catalog().add_track("Pulse", "Ava", "Night", 180)

def test_fixture_receiver(catalog):
    assert catalog.add_track("Flow", "Ben", "Day", 210)

def test_factory_receiver():
    local = make_catalog()
    assert local.add_track("Wave", "Cy", "Dawn", 240)
`;
    const workspace = workspaceFrom({ 'catalog.py': catalog, 'test_catalog.py': tests }, 'catalog.py');
    const analysis = analyze(workspace);
    const plan = adapter.planParameterObject(
      workspace,
      analysis,
      'catalog.py',
      positionOn(catalog, 'def add_track'),
      'TrackInfo',
      ['artist', 'album']
    );
    expect(plan.error).toBeFalsy();
    expect(applyPlan(workspace, plan)['test_catalog.py']).toBe(text`
from catalog import TrackCatalog as Catalog, TrackInfo

def catalog() -> Catalog:
    return Catalog()

def make_catalog() -> Catalog:
    return Catalog()

def test_inline_receiver():
    assert Catalog().add_track("Pulse", TrackInfo("Ava", "Night"), 180)

def test_fixture_receiver(catalog):
    assert catalog.add_track("Flow", TrackInfo("Ben", "Day"), 210)

def test_factory_receiver():
    local = make_catalog()
    assert local.add_track("Wave", TrackInfo("Cy", "Dawn"), 240)
`);
  });

  test('introduce parameter object honors import aliases and skips unrelated same-named functions', () => {
    const tracks = text`
def add_track(title: str, artist: str, album: str, genre: str, duration_sec: int):
    return f"{title}:{artist}:{album}:{genre}:{duration_sec}"
`;
    const app = text`
from tracks import add_track as create_track
from other import add_track as add_other

first = create_track("Pulse", "Ava", "Night", "pop", 180)
second = add_other("Spot", "Bot", "Ads", "ad", 30)
`;
    const other = text`
def add_track(title: str, artist: str, album: str, genre: str, duration_sec: int):
    return title

local = add_track("Local", "Lin", "Elsewhere", "folk", 120)
`;
    const workspace = workspaceFrom({
      'tracks.py': tracks,
      'app.py': app,
      'other.py': other,
    }, 'tracks.py');
    const analysis = analyze(workspace);
    const plan = adapter.planParameterObject(
      workspace,
      analysis,
      'tracks.py',
      positionOn(tracks, 'return f'),
      'AlbumInfo',
      ['artist', 'album', 'genre']
    );
    expect(plan.error).toBeFalsy();
    const applied = applyPlan(workspace, plan);
    expect(applied['tracks.py']).toBe(text`
from dataclasses import dataclass

@dataclass
class AlbumInfo:
    artist: str
    album: str
    genre: str

def add_track(title: str, album_info: AlbumInfo, duration_sec: int):
    return f"{title}:{album_info.artist}:{album_info.album}:{album_info.genre}:{duration_sec}"
`);
    expect(applied['app.py']).toBe(text`
from tracks import add_track as create_track, AlbumInfo
from other import add_track as add_other

first = create_track("Pulse", AlbumInfo("Ava", "Night", "pop"), 180)
second = add_other("Spot", "Bot", "Ads", "ad", 30)
`);
    expect(applied['other.py']).toBe(other);
  });

  test('introduce parameter object does not rewrite nested function parameters', () => {
    const before = text`
def add_track(title: str, artist: str, album: str, genre: str):
    def nested(artist: str):
        return artist.upper()
    label = f"{artist} / {album}"
    return nested(title), label, genre
`;
    const workspace = workspaceFrom({ 'tracks.py': before }, 'tracks.py');
    const analysis = analyze(workspace);
    const plan = adapter.planParameterObject(
      workspace,
      analysis,
      'tracks.py',
      positionOn(before, 'label ='),
      'AlbumInfo',
      ['artist', 'album', 'genre']
    );
    expect(plan.error).toBeFalsy();
    expect(applyPlan(workspace, plan)['tracks.py']).toBe(text`
from dataclasses import dataclass

@dataclass
class AlbumInfo:
    artist: str
    album: str
    genre: str

def add_track(title: str, album_info: AlbumInfo):
    def nested(artist: str):
        return artist.upper()
    label = f"{album_info.artist} / {album_info.album}"
    return nested(title), label, album_info.genre
`);
  });

  test('introduce parameter object rewrites module-alias calls in another file', () => {
    const tracks = text`
def add_track(title: str, artist: str, album: str, duration_sec: int):
    return title, artist, album, duration_sec
`;
    const app = text`
import tracks as track_module

created = track_module.add_track("Flow", "Ben", "Day", 210)
`;
    const workspace = workspaceFrom({ 'tracks.py': tracks, 'app.py': app }, 'tracks.py');
    const analysis = analyze(workspace);
    const plan = adapter.planParameterObject(
      workspace,
      analysis,
      'tracks.py',
      positionOn(tracks, 'return title'),
      'AlbumInfo',
      ['artist', 'album']
    );
    expect(plan.error).toBeFalsy();
    const applied = applyPlan(workspace, plan);
    expect(applied['app.py']).toBe(text`
import tracks as track_module
from tracks import AlbumInfo

created = track_module.add_track("Flow", AlbumInfo("Ben", "Day"), 210)
`);
  });

  test('introduce parameter object refuses varargs, defaults, name collisions, and wildcard imports', () => {
    const varargs = text`
def add_track(title, artist, *extras, **metadata):
    return title, artist, extras, metadata
`;
    let workspace = workspaceFrom({ 'tracks.py': varargs }, 'tracks.py');
    let analysis = analyze(workspace);
    expect(adapter.planParameterObject(
      workspace,
      analysis,
      'tracks.py',
      positionOn(varargs, 'return title'),
      'TrackInfo',
      ['title', 'artist']
    ).error).toContain('*args');

    const defaults = text`
def add_track(title, artist="unknown", album="single"):
    return title, artist, album
`;
    workspace = workspaceFrom({ 'tracks.py': defaults }, 'tracks.py');
    analysis = analyze(workspace);
    expect(adapter.planParameterObject(
      workspace,
      analysis,
      'tracks.py',
      positionOn(defaults, 'return title'),
      'TrackInfo',
      ['artist', 'album']
    ).error).toContain('defaults');

    const collision = text`
class TrackInfo:
    pass

def add_track(title, artist, album):
    return title, artist, album
`;
    workspace = workspaceFrom({ 'tracks.py': collision }, 'tracks.py');
    analysis = analyze(workspace);
    expect(adapter.planParameterObject(
      workspace,
      analysis,
      'tracks.py',
      positionOn(collision, 'return title'),
      'TrackInfo',
      ['artist', 'album']
    ).error).toContain('already exists');

    const tracks = text`
def add_track(title, artist, album):
    return title, artist, album
`;
    const app = text`
from tracks import *

created = add_track("Pulse", "Ava", "Night")
`;
    workspace = workspaceFrom({ 'tracks.py': tracks, 'app.py': app }, 'tracks.py');
    analysis = analyze(workspace);
    expect(adapter.planParameterObject(
      workspace,
      analysis,
      'tracks.py',
      positionOn(tracks, 'return title'),
      'TrackInfo',
      ['artist', 'album']
    ).error).toContain('Wildcard');
  });

  test('offers extract class for a selected cohesive field and method cluster', () => {
    const before = text`
from typing import Dict, List

class StreamingApp:
    def __init__(self, user_id: str) -> None:
        self.user_id = user_id
        self.track_index: Dict[str, dict] = {}
        self.subscription_tier: str = "free"
        self.payment_method: str = ""
        self.invoice_list: List[Dict] = []

    def search(self, query: str) -> List[str]:
        return [tid for tid in self.track_index if query in tid]

    def charge_monthly(self) -> Dict:
        invoice: Dict = {"period": "monthly", "method": self.payment_method}
        self.invoice_list.append(invoice)
        return invoice

    def send_invoice(self, invoice_index: int) -> bool:
        return invoice_index < len(self.invoice_list)
`;
    const workspace = workspaceFrom({ 'streaming_app.py': before }, 'streaming_app.py');
    const analysis = analyze(workspace);
    const selection = selectionBetween(
      before,
      'self.subscription_tier',
      'return invoice_index < len(self.invoice_list)'
    );
    expect(api.computePythonActionAvailability(
      workspace,
      analysis,
      'streaming_app.py',
      positionOn(before, 'self.subscription_tier'),
      selection,
      null
    )).toMatchObject({
      extractClass: true,
    });
  });

  test('extracts a class from selected fields and methods and rewrites typed call sites', () => {
    const streaming = text`
from typing import Dict, List

class StreamingApp:
    def __init__(self, user_id: str) -> None:
        self.user_id = user_id
        self.track_index: Dict[str, dict] = {}
        self.subscription_tier: str = "free"
        self.payment_method: str = ""
        self.invoice_list: List[Dict] = []

    def search(self, query: str) -> List[str]:
        return [tid for tid in self.track_index if query in tid]

    def charge_monthly(self) -> Dict:
        invoice: Dict = {"period": "monthly", "method": self.payment_method}
        self.invoice_list.append(invoice)
        return invoice

    def send_invoice(self, invoice_index: int) -> bool:
        return invoice_index < len(self.invoice_list)
`;
    const views = text`
from streaming_app import StreamingApp

def bill(app: StreamingApp):
    return app.charge_monthly()
`;
    const workspace = workspaceFrom({
      'streaming_app.py': streaming,
      'views.py': views,
    }, 'streaming_app.py');
    const analysis = analyze(workspace);
    const plan = adapter.planExtractClass(
      workspace,
      analysis,
      'streaming_app.py',
      positionOn(streaming, 'class StreamingApp'),
      'BillingManager',
      'billing',
      ['subscription_tier', 'payment_method', 'invoice_list'],
      ['charge_monthly', 'send_invoice']
    );
    expect(plan.error).toBeFalsy();
    const applied = applyPlan(workspace, plan);
    expect(applied['streaming_app.py']).toBe(text`
from typing import Dict, List

class BillingManager:
    def __init__(self) -> None:
        self.subscription_tier: str = "free"
        self.payment_method: str = ""
        self.invoice_list: List[Dict] = []

    def charge_monthly(self) -> Dict:
        invoice: Dict = {"period": "monthly", "method": self.payment_method}
        self.invoice_list.append(invoice)
        return invoice

    def send_invoice(self, invoice_index: int) -> bool:
        return invoice_index < len(self.invoice_list)

class StreamingApp:
    def __init__(self, user_id: str) -> None:
        self.user_id = user_id
        self.track_index: Dict[str, dict] = {}
        self.billing = BillingManager()

    def search(self, query: str) -> List[str]:
        return [tid for tid in self.track_index if query in tid]
`);
    expect(applied['views.py']).toBe(text`
from streaming_app import StreamingApp

def bill(app: StreamingApp):
    return app.billing.charge_monthly()
`);
  });

  test('extract class rewrites method calls in test files with constructed, inline, fixture, and factory receivers', () => {
    const streaming = text`
from typing import Dict, List

class StreamingApp:
    def __init__(self) -> None:
        self.payment_method: str = ""
        self.invoice_list: List[Dict] = []

    def charge_monthly(self) -> Dict:
        invoice: Dict = {"method": self.payment_method}
        self.invoice_list.append(invoice)
        return invoice

    def send_invoice(self, invoice_index: int) -> bool:
        return invoice_index < len(self.invoice_list)
`;
    const tests = text`
from streaming_app import StreamingApp as App

def test_billing_flow():
    app = App()
    invoice = app.charge_monthly()
    assert app.send_invoice(0)
    assert invoice["method"] == ""

def app() -> App:
    return App()

def make_app() -> App:
    return App()

def test_inline_receiver():
    assert App().send_invoice(0)

def test_fixture_receiver(app):
    assert app.charge_monthly()["method"] == ""

def test_factory_receiver():
    local = make_app()
    assert local.send_invoice(0)
`;
    const workspace = workspaceFrom({
      'streaming_app.py': streaming,
      'test_streaming_app.py': tests,
    }, 'streaming_app.py');
    const analysis = analyze(workspace);
    const plan = adapter.planExtractClass(
      workspace,
      analysis,
      'streaming_app.py',
      positionOn(streaming, 'class StreamingApp'),
      'BillingManager',
      'billing',
      ['payment_method', 'invoice_list'],
      ['charge_monthly', 'send_invoice']
    );
    expect(plan.error).toBeFalsy();
    expect(plan.edits.map((edit) => edit.filename)).toContain('test_streaming_app.py');
    const previewRows = api.buildPreviewFileHunks('test_streaming_app.py', plan.edits, workspace, 2)
      .flatMap((hunk) => hunk.rows.map((row) => [row.kind, row.text]));
    expect(previewRows).toContainEqual(['new', '    invoice = app.billing.charge_monthly()']);
    expect(previewRows).toContainEqual(['new', '    assert app.billing.send_invoice(0)']);
    expect(previewRows).toContainEqual(['new', '    assert App().billing.send_invoice(0)']);
    expect(previewRows).toContainEqual(['new', '    assert app.billing.charge_monthly()["method"] == ""']);
    expect(previewRows).toContainEqual(['new', '    assert local.billing.send_invoice(0)']);
    expect(applyPlan(workspace, plan)['test_streaming_app.py']).toBe(text`
from streaming_app import StreamingApp as App

def test_billing_flow():
    app = App()
    invoice = app.billing.charge_monthly()
    assert app.billing.send_invoice(0)
    assert invoice["method"] == ""

def app() -> App:
    return App()

def make_app() -> App:
    return App()

def test_inline_receiver():
    assert App().billing.send_invoice(0)

def test_fixture_receiver(app):
    assert app.billing.charge_monthly()["method"] == ""

def test_factory_receiver():
    local = make_app()
    assert local.billing.send_invoice(0)
`);
  });

  test('extract class preview keeps unrelated section comments anchored in the source class', () => {
    const before = text`
from typing import Dict, List

class StreamingApp:
    def __init__(self, user_id: str) -> None:
        self.user_id: str = user_id

        # ----- Catalog cluster -----
        self.track_index: Dict[str, dict] = {}
        self.search_history: List[str] = []
        self.recommendation_cache: Dict[str, List[str]] = {}

        # ----- Billing cluster -----
        self.subscription_tier: str = "free"
        self.payment_method: str = ""
        self.invoice_list: List[Dict] = []

    # ----- Catalog methods -----
    def search(self, query: str) -> List[str]:
        self.search_history.append(query)
        return [tid for tid in self.track_index if query in tid]

    # ----- Billing methods -----
    def send_invoice(self, invoice_index: int) -> bool:
        if invoice_index >= len(self.invoice_list):
            return False
        # Pretend to email the invoice.
        return True
`;
    const workspace = workspaceFrom({ 'streaming_app.py': before }, 'streaming_app.py');
    const analysis = analyze(workspace);
    const plan = adapter.planExtractClass(
      workspace,
      analysis,
      'streaming_app.py',
      positionOn(before, 'class StreamingApp'),
      'BillingManager',
      'billing',
      ['subscription_tier', 'payment_method', 'invoice_list'],
      ['send_invoice']
    );
    expect(plan.error).toBeFalsy();
    const after = applyPlan(workspace, plan)['streaming_app.py'];
    expect(after).toContain('        # ----- Catalog cluster -----');
    expect(after).toContain('        # ----- Billing cluster -----');
    expect(after.indexOf('class BillingManager:')).toBeLessThan(after.indexOf('class StreamingApp:'));
    expect(after.indexOf('        # ----- Catalog cluster -----')).toBeGreaterThan(after.indexOf('class StreamingApp:'));

    const hunks = api.buildPreviewFileHunks('streaming_app.py', plan.edits, workspace, 3);
    const rows = hunks.flatMap((hunk) => hunk.rows);
    const deletedComments = rows
      .filter((row) => row.kind === 'old')
      .map((row) => row.text)
      .filter((textLine) => textLine.includes('Catalog cluster') || textLine.includes('Billing cluster'));
    expect(deletedComments).toEqual([]);
  });

  test('extract class rewrites remaining source methods that reference moved fields', () => {
    const before = text`
from typing import Dict, List

class StreamingApp:
    def __init__(self, user_id: str) -> None:
        self.user_id: str = user_id
        self.track_index: Dict[str, dict] = {}
        self.search_history: List[str] = []
        self.recommendation_cache: Dict[str, List[str]] = {}
        self.subscription_tier: str = "free"
        self.payment_method: str = ""
        self.invoice_list: List[Dict] = []

    def search(self, query: str) -> List[str]:
        self.search_history.append(query)
        return [tid for tid, info in self.track_index.items()
                if query.lower() in info.get("title", "").lower()]

    def charge_monthly(self) -> Dict:
        invoice: Dict = {"period": "monthly", "method": self.payment_method}
        self.invoice_list.append(invoice)
        return invoice

    def charge_annual(self) -> Dict:
        invoice: Dict = {"period": "annual", "method": self.payment_method}
        self.invoice_list.append(invoice)
        return invoice

    def send_invoice(self, invoice_index: int) -> bool:
        if invoice_index >= len(self.invoice_list):
            return False
        return True

    def notify_payment_due(self) -> str:
        return f"Payment of $9.99 due on {self.payment_method}"
`;
    const workspace = workspaceFrom({ 'streaming_app.py': before }, 'streaming_app.py');
    const analysis = analyze(workspace);
    const plan = adapter.planExtractClass(
      workspace,
      analysis,
      'streaming_app.py',
      positionOn(before, 'class StreamingApp'),
      'ExtractedStreamingApp',
      'extracted_streaming_app',
      ['user_id', 'track_index', 'payment_method', 'invoice_list'],
      ['charge_monthly', 'charge_annual']
    );
    expect(plan.error).toBeFalsy();
    const after = applyPlan(workspace, plan)['streaming_app.py'];
    expect(after).toContain('self.extracted_streaming_app = ExtractedStreamingApp(user_id)');
    expect(after).toContain('for tid, info in self.extracted_streaming_app.track_index.items()');
    expect(after).toContain('if invoice_index >= len(self.extracted_streaming_app.invoice_list):');
    expect(after).toContain('return f"Payment of $9.99 due on {self.extracted_streaming_app.payment_method}"');
    expect(after).not.toContain('self.track_index.items()');
    expect(after).not.toContain('len(self.invoice_list)');
    expect(after).not.toContain('{self.payment_method}');
  });

  test('extract class refuses methods that still use source-class state', () => {
    const before = text`
class StreamingApp:
    def __init__(self):
        self.track_index = {}
        self.payment_method = ""
        self.invoice_list = []

    def charge_monthly(self):
        self.track_index["last_charge"] = "monthly"
        self.invoice_list.append({"method": self.payment_method})
`;
    const workspace = workspaceFrom({ 'streaming_app.py': before }, 'streaming_app.py');
    const analysis = analyze(workspace);
    const plan = adapter.planExtractClass(
      workspace,
      analysis,
      'streaming_app.py',
      positionOn(before, 'class StreamingApp'),
      'BillingManager',
      'billing',
      ['payment_method', 'invoice_list'],
      ['charge_monthly']
    );
    expect(plan.error).toContain('self.track_index');
  });

  test('extracts a methods-only class and creates the delegate field safely', () => {
    const before = text`
class Formatter:
    def render(self, title: str) -> str:
        return self.slug(title)

    def normalize(self, text: str) -> str:
        return text.strip().lower()

    def slug(self, text: str) -> str:
        return self.normalize(text).replace(" ", "-")
`;
    const workspace = workspaceFrom({ 'formatter.py': before }, 'formatter.py');
    const analysis = analyze(workspace);
    const plan = adapter.planExtractClass(
      workspace,
      analysis,
      'formatter.py',
      positionOn(before, 'class Formatter'),
      'TextTools',
      'text_tools',
      [],
      ['normalize', 'slug']
    );
    expect(plan.error).toBeFalsy();
    expect(applyPlan(workspace, plan)['formatter.py']).toBe(text`
class TextTools:
    def normalize(self, text: str) -> str:
        return text.strip().lower()

    def slug(self, text: str) -> str:
        return self.normalize(text).replace(" ", "-")

class Formatter:
    def __init__(self) -> None:
        self.text_tools = TextTools()

    def render(self, title: str) -> str:
        return self.text_tools.slug(title)
`);
  });

  test('extract class rejects selected fields that are not direct __init__ fields', () => {
    const before = text`
class Billing:
    def __init__(self):
        pass

    def configure(self):
        self.payment_method = ""

    def charge(self):
        return self.payment_method
`;
    const workspace = workspaceFrom({ 'billing.py': before }, 'billing.py');
    const analysis = analyze(workspace);
    const plan = adapter.planExtractClass(
      workspace,
      analysis,
      'billing.py',
      positionOn(before, 'class Billing'),
      'BillingState',
      'billing_state',
      ['payment_method'],
      ['charge']
    );
    expect(plan.error).toContain('assigned directly on self in __init__');
  });

  test('extract class dialog shows semantic selection errors inline and disables continue', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ path: enginePath });
    const result = await page.evaluate(async () => {
      const api = window.SebookRefactorings._test;
      const pending = api.askExtractClass({
        title: 'Extract Class',
        className: 'BillingManager',
        delegateName: 'billing',
        fields: [{ name: 'payment_method' }, { name: 'invoice_list' }],
        methods: [{ name: 'record_recommendation' }, { name: 'charge_monthly' }],
        selectedFieldNames: ['payment_method', 'invoice_list'],
        selectedMethodNames: ['record_recommendation'],
        validateState(state) {
          return state.selectedMethodNames.includes('record_recommendation')
            ? 'Extract Class cannot move record_recommendation because it still uses self.recommendation_cache.'
            : '';
        },
      });
      const errorBefore = document.querySelector('.sbr-error').textContent;
      const errorIsBeforeUml = !!(document.querySelector('.sbr-error').compareDocumentPosition(
        document.querySelector('.sbr-uml-preview')
      ) & Node.DOCUMENT_POSITION_FOLLOWING);
      const disabledBefore = document.querySelector('.sbr-primary').disabled;
      const checkbox = document.querySelector('input[value="method:record_recommendation"]');
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      const errorAfter = document.querySelector('.sbr-error').textContent;
      const disabledAfter = document.querySelector('.sbr-primary').disabled;
      document.querySelector('.sbr-cancel').click();
      await pending;
      return { errorBefore, errorIsBeforeUml, disabledBefore, errorAfter, disabledAfter };
    });
    expect(result).toEqual({
      errorBefore: 'Extract Class cannot move record_recommendation because it still uses self.recommendation_cache.',
      errorIsBeforeUml: true,
      disabledBefore: true,
      errorAfter: '',
      disabledAfter: false,
    });
  });

  test('extract class dialog supports check all, uncheck all, and methods-only selections', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ path: enginePath });
    const result = await page.evaluate(async () => {
      const api = window.SebookRefactorings._test;
      const pending = api.askExtractClass({
        title: 'Extract Class',
        className: 'TextTools',
        delegateName: 'text_tools',
        fields: [{ name: 'prefix' }],
        methods: [{ name: 'normalize' }, { name: 'slug' }],
        selectedFieldNames: [],
        selectedMethodNames: ['normalize', 'slug'],
      });
      const initialError = document.querySelector('.sbr-error').textContent;
      const initialDisabled = document.querySelector('.sbr-primary').disabled;
      const initialChecked = document.querySelectorAll('.sbr-check input:checked').length;
      document.querySelector('.sbr-uncheck-all').click();
      const uncheckedError = document.querySelector('.sbr-error').textContent;
      const uncheckedDisabled = document.querySelector('.sbr-primary').disabled;
      document.querySelector('.sbr-check-all').click();
      const checkedError = document.querySelector('.sbr-error').textContent;
      const checkedDisabled = document.querySelector('.sbr-primary').disabled;
      const checkedCount = document.querySelectorAll('.sbr-check input:checked').length;
      document.querySelector('.sbr-cancel').click();
      await pending;
      return {
        initialError,
        initialDisabled,
        initialChecked,
        uncheckedError,
        uncheckedDisabled,
        checkedError,
        checkedDisabled,
        checkedCount,
      };
    });
    expect(result).toEqual({
      initialError: '',
      initialDisabled: false,
      initialChecked: 2,
      uncheckedError: 'Select at least two fields or methods.',
      uncheckedDisabled: true,
      checkedError: '',
      checkedDisabled: false,
      checkedCount: 3,
    });
  });

  test('extract class dialog renders a live before and after UML preview', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ path: enginePath });
    const result = await page.evaluate(async () => {
      window.UMLClassDiagram = {
        render(container, spec) {
          container.dataset.stubRendered = 'true';
          container.textContent = spec;
        },
      };
      const api = window.SebookRefactorings._test;
      const pending = api.askExtractClass({
        title: 'Extract Class',
        ownerName: 'StreamingApp',
        className: 'BillingManager',
        delegateName: 'billing',
        fields: [{ name: 'payment_method' }, { name: 'invoice_list' }],
        methods: [{ name: 'search' }, { name: 'charge_monthly' }],
        selectedFieldNames: ['payment_method', 'invoice_list'],
        selectedMethodNames: ['charge_monthly'],
      });
      const initialText = document.querySelector('.sbr-uml-preview').textContent;
      const modalWide = document.querySelector('.sbr-modal').classList.contains('sbr-modal-extract-class');
      const panelCount = document.querySelectorAll('.sbr-uml-panel').length;
      const diagramCount = document.querySelectorAll('.sbr-uml-diagram[data-uml-type="class"][data-stub-rendered="true"]').length;
      const customBoxCount = document.querySelectorAll('.sbr-uml-class').length;
      const initialAfterSpec = document.querySelectorAll('.sbr-uml-diagram')[1].dataset.umlSpec;
      document.querySelector('input[value="method:charge_monthly"]').checked = false;
      document.querySelector('input[value="method:charge_monthly"]')
        .dispatchEvent(new Event('change', { bubbles: true }));
      const afterUncheckText = document.querySelector('.sbr-uml-preview').textContent;
      const afterSpec = document.querySelectorAll('.sbr-uml-diagram')[1].dataset.umlSpec;
      document.querySelector('.sbr-cancel').click();
      await pending;
      return {
        modalWide,
        panelCount,
        diagramCount,
        customBoxCount,
        initialText,
        initialAfterSpec,
        afterUncheckText,
        afterSpec,
      };
    });
    expect(result.modalWide).toBe(true);
    expect(result.panelCount).toBe(2);
    expect(result.diagramCount).toBe(2);
    expect(result.customBoxCount).toBe(0);
    expect(result.initialText).toContain('Before');
    expect(result.initialText).toContain('After');
    expect(result.initialText).toContain('StreamingApp');
    expect(result.initialText).toContain('BillingManager');
    expect(result.initialText).toContain('billing: BillingManager');
    expect(result.initialText).toContain('charge_monthly()');
    expect(result.initialAfterSpec).toContain('StreamingApp o--> BillingManager : billing');
    expect(result.afterUncheckText).toContain('charge_monthly()');
    expect(result.afterSpec.slice(result.afterSpec.indexOf('class BillingManager'))).not.toContain('+ charge_monthly()');
  });

  test('rename, parameter object, and move target dialogs validate inline before submit', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ path: enginePath });
    const result = await page.evaluate(async () => {
      const api = window.SebookRefactorings._test;
      const out = {};

      let pending = api.askText({
        title: 'Rename Symbol',
        label: 'New name',
        value: 'score',
        validate(value) {
          if (value === 'score') return 'Choose a different name.';
          if (value === 'label') return 'Renaming would collide with an existing name in this scope.';
          return '';
        },
      });
      let input = document.querySelector('.sbr-input');
      out.renameInitialDisabled = document.querySelector('.sbr-primary').disabled;
      input.value = 'label';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      out.renameError = document.querySelector('.sbr-error').textContent;
      out.renameDisabled = document.querySelector('.sbr-primary').disabled;
      input.value = 'rating';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      out.renameCleared = document.querySelector('.sbr-error').textContent;
      out.renameEnabled = !document.querySelector('.sbr-primary').disabled;
      document.querySelector('.sbr-cancel').click();
      await pending;

      pending = api.askParameterObject({
        title: 'Introduce Parameter Object',
        objectName: 'ExistingParams',
        params: [{ name: 'artist', text: 'artist: str' }, { name: 'album', text: 'album: str' }],
        selectedParamNames: ['artist', 'album'],
        validateState(state) {
          return state.objectName === 'ExistingParams'
            ? 'A symbol named ExistingParams already exists in this file.'
            : '';
        },
      });
      input = document.querySelector('.sbr-input');
      out.paramError = document.querySelector('.sbr-error').textContent;
      out.paramDisabled = document.querySelector('.sbr-primary').disabled;
      input.value = 'AlbumInfo';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      out.paramCleared = document.querySelector('.sbr-error').textContent;
      out.paramEnabled = !document.querySelector('.sbr-primary').disabled;
      document.querySelector('.sbr-cancel').click();
      await pending;

      pending = api.askChoice({
        title: 'Move Method',
        label: 'Target class',
        options: ['Track', 'Reporter'],
        validateChoice(value) {
          return value === 'Reporter'
            ? 'Move Method needs a parameter whose type or name matches the target class.'
            : '';
        },
      });
      const select = document.querySelector('select');
      select.value = 'Reporter';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      out.choiceError = document.querySelector('.sbr-error').textContent;
      out.choiceDisabled = document.querySelector('.sbr-primary').disabled;
      select.value = 'Track';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      out.choiceCleared = document.querySelector('.sbr-error').textContent;
      out.choiceEnabled = !document.querySelector('.sbr-primary').disabled;
      document.querySelector('.sbr-cancel').click();
      await pending;

      pending = api.askChoice({
        title: 'Move Field',
        label: 'Target class',
        options: ['PlaybackState', 'Reporter'],
        validateChoice(value) {
          return value === 'PlaybackState'
            ? 'Move Field found references to self.cache but no existing self.<field> reference to PlaybackState to rewrite through.'
            : '';
        },
      });
      const fieldSelect = document.querySelector('select');
      out.moveFieldInitialError = document.querySelector('.sbr-error').textContent;
      out.moveFieldInitialDisabled = document.querySelector('.sbr-primary').disabled;
      fieldSelect.value = 'Reporter';
      fieldSelect.dispatchEvent(new Event('change', { bubbles: true }));
      out.moveFieldCleared = document.querySelector('.sbr-error').textContent;
      out.moveFieldEnabled = !document.querySelector('.sbr-primary').disabled;
      document.querySelector('.sbr-cancel').click();
      await pending;

      return out;
    });
    expect(result).toEqual({
      renameInitialDisabled: true,
      renameError: 'Renaming would collide with an existing name in this scope.',
      renameDisabled: true,
      renameCleared: '',
      renameEnabled: true,
      paramError: 'A symbol named ExistingParams already exists in this file.',
      paramDisabled: true,
      paramCleared: '',
      paramEnabled: true,
      choiceError: 'Move Method needs a parameter whose type or name matches the target class.',
      choiceDisabled: true,
      choiceCleared: '',
      choiceEnabled: true,
      moveFieldInitialError: 'Move Field found references to self.cache but no existing self.<field> reference to PlaybackState to rewrite through.',
      moveFieldInitialDisabled: true,
      moveFieldCleared: '',
      moveFieldEnabled: true,
    });
  });

  test('moves a method to the parameter object class and rewrites call sites', () => {
    const player = text`
from track import Track

class Player:
    def compute_remaining_seconds(self, track: Track, elapsed: int):
        remaining = track.duration_sec - elapsed
        return max(remaining, 0)

    def label(self, track: Track):
        return self.compute_remaining_seconds(track, 5)

def render(player: Player, track: Track):
    return player.compute_remaining_seconds(track, elapsed=10)

def render_keyword(player: Player, track: Track):
    return player.compute_remaining_seconds(track=track, elapsed=20)
`;
    const track = text`
class Track:
    def __init__(self, title: str, duration_sec: int):
        self.title = title
        self.duration_sec = duration_sec
`;
    const workspace = workspaceFrom({ 'player.py': player, 'track.py': track }, 'player.py');
    const analysis = analyze(workspace);
    const plan = adapter.planMoveMethod(
      workspace,
      analysis,
      'player.py',
      positionOn(player, 'remaining ='),
      'Track'
    );
    expect(plan.error).toBeFalsy();
    const applied = applyPlan(workspace, plan);
    expect(applied['player.py']).toBe(text`
from track import Track

class Player:
    def compute_remaining_seconds(self, track: Track, elapsed: int):
        return track.compute_remaining_seconds(elapsed)

    def label(self, track: Track):
        return track.compute_remaining_seconds(5)

def render(player: Player, track: Track):
    return track.compute_remaining_seconds(elapsed=10)

def render_keyword(player: Player, track: Track):
    return track.compute_remaining_seconds(elapsed=20)
`);
    expect(applied['track.py']).toBe(text`
class Track:
    def __init__(self, title: str, duration_sec: int):
        self.title = title
        self.duration_sec = duration_sec

    def compute_remaining_seconds(self, elapsed: int):
        remaining = self.duration_sec - elapsed
        return max(remaining, 0)
`);
  });

  test('move method rewrites typed cross-file receivers and leaves unrelated receivers alone', () => {
    const player = text`
from track import Track

class Player:
    def compute_remaining_seconds(self, track: Track, elapsed: int):
        remaining = track.duration_sec - elapsed
        return max(remaining, 0)

    def name(self):
        return "player"
`;
    const track = text`
class Track:
    def __init__(self, title: str, duration_sec: int):
        self.title = title
        self.duration_sec = duration_sec
`;
    const views = text`
from player import Player
from track import Track

class Reporter:
    def compute_remaining_seconds(self, track: Track, elapsed: int):
        return -1

def render(player: Player, reporter: Reporter, track: Track):
    value = player.compute_remaining_seconds(track, 10)
    other = reporter.compute_remaining_seconds(track, 5)
    return value, other
`;
    const workspace = workspaceFrom({
      'player.py': player,
      'track.py': track,
      'views.py': views,
    }, 'player.py');
    const analysis = analyze(workspace);
    const plan = adapter.planMoveMethod(
      workspace,
      analysis,
      'player.py',
      positionOn(player, 'remaining ='),
      'Track'
    );
    expect(plan.error).toBeFalsy();
    const applied = applyPlan(workspace, plan);
    expect(applied['player.py']).toBe(text`
from track import Track

class Player:
    def compute_remaining_seconds(self, track: Track, elapsed: int):
        return track.compute_remaining_seconds(elapsed)

    def name(self):
        return "player"
`);
    expect(applied['views.py']).toBe(text`
from player import Player
from track import Track

class Reporter:
    def compute_remaining_seconds(self, track: Track, elapsed: int):
        return -1

def render(player: Player, reporter: Reporter, track: Track):
    value = track.compute_remaining_seconds(10)
    other = reporter.compute_remaining_seconds(track, 5)
    return value, other
`);
    expect(applied['track.py']).toBe(text`
class Track:
    def __init__(self, title: str, duration_sec: int):
        self.title = title
        self.duration_sec = duration_sec

    def compute_remaining_seconds(self, elapsed: int):
        remaining = self.duration_sec - elapsed
        return max(remaining, 0)
`);
  });

  test('move method refuses decorated methods, super calls, and hidden source-object state', () => {
    const decorated = text`
class Track:
    pass

class Player:
    @staticmethod
    def compute_remaining_seconds(self, track: Track, elapsed: int):
        return elapsed
`;
    let workspace = workspaceFrom({ 'player.py': decorated }, 'player.py');
    let analysis = analyze(workspace);
    expect(adapter.planMoveMethod(
      workspace,
      analysis,
      'player.py',
      positionOn(decorated, 'return elapsed'),
      'Track'
    ).error).toContain('decorated');

    const withSuper = text`
class Track:
    pass

class Player(BasePlayer):
    def compute_remaining_seconds(self, track: Track, elapsed: int):
        base = super().compute_remaining_seconds(track, elapsed)
        return base
`;
    workspace = workspaceFrom({ 'player.py': withSuper }, 'player.py');
    analysis = analyze(workspace);
    expect(adapter.planMoveMethod(
      workspace,
      analysis,
      'player.py',
      positionOn(withSuper, 'base = super()'),
      'Track'
    ).error).toContain('super');

    const sourceState = text`
class Track:
    pass

class Player:
    def compute_remaining_seconds(self, track: Track, elapsed: int):
        return track.duration_sec - elapsed + self.offset
`;
    workspace = workspaceFrom({ 'player.py': sourceState }, 'player.py');
    analysis = analyze(workspace);
    expect(adapter.planMoveMethod(
      workspace,
      analysis,
      'player.py',
      positionOn(sourceState, 'return track.duration_sec'),
      'Track'
    ).error).toContain('source-object state');
  });

  test('offers move method only when the current method has an AST-inferred target class parameter', () => {
    const player = text`
from track import Track

class Player:
    def compute_remaining_seconds(self, track: Track, elapsed: int):
        remaining = track.duration_sec - elapsed
        return max(remaining, 0)

    def label(self):
        return "player"
`;
    const track = text`
class Track:
    pass
`;
    const workspace = workspaceFrom({ 'player.py': player, 'track.py': track }, 'player.py');
    const analysis = analyze(workspace);
    expect(api.computePythonActionAvailability(
      workspace,
      analysis,
      'player.py',
      positionOn(player, 'remaining ='),
      null,
      'remaining'
    )).toMatchObject({
      rename: true,
      extract: false,
      parameterObject: true,
      moveMethod: true,
      moveField: false,
    });
    expect(api.computePythonActionAvailability(
      workspace,
      analysis,
      'player.py',
      positionOn(player, 'return "player"'),
      null,
      null
    )).toMatchObject({
      parameterObject: false,
      moveMethod: false,
      moveField: false,
    });
  });

  test('moves a simple field initializer into a target class constructor', () => {
    const before = text`
class Player:
    def __init__(self):
        self.cache = {}
        self.volume = 75

class PlaybackState:
    pass
`;
    const workspace = workspaceFrom({ 'player.py': before }, 'player.py');
    const analysis = analyze(workspace);
    const plan = adapter.planMoveField(
      workspace,
      analysis,
      'player.py',
      positionOn(before, 'self.cache'),
      'PlaybackState'
    );
    expect(plan.error).toBeFalsy();
    expect(applyPlan(workspace, plan)['player.py']).toBe(text`
class Player:
    def __init__(self):
        self.volume = 75

class PlaybackState:
    def __init__(self):
        self.cache = {}
`);
  });

  test('move field rewrites source and typed cross-file references through an existing delegate', () => {
    const player = text`
class Player:
    def __init__(self):
        self.state = PlaybackState()
        self.cache = {}
        self.volume = 75

    def remember(self, track_id):
        self.cache[track_id] = True
        return self.cache.get(track_id, False)

class PlaybackState:
    pass
`;
    const view = text`
from player import Player

def is_cached(player: Player, track_id):
    return player.cache.get(track_id, False)
`;
    const workspace = workspaceFrom({ 'player.py': player, 'view.py': view }, 'player.py');
    const analysis = analyze(workspace);
    const plan = adapter.planMoveField(
      workspace,
      analysis,
      'player.py',
      positionOn(player, 'self.cache = {}'),
      'PlaybackState'
    );
    expect(plan.error).toBeFalsy();
    const applied = applyPlan(workspace, plan);
    expect(applied['player.py']).toBe(text`
class Player:
    def __init__(self):
        self.state = PlaybackState()
        self.volume = 75

    def remember(self, track_id):
        self.state.cache[track_id] = True
        return self.state.cache.get(track_id, False)

class PlaybackState:
    def __init__(self):
        self.cache = {}
`);
    expect(applied['view.py']).toBe(text`
from player import Player

def is_cached(player: Player, track_id):
    return player.state.cache.get(track_id, False)
`);
  });

  test('move field refuses referenced fields when no target delegate exists', () => {
    const before = text`
class Player:
    def __init__(self):
        self.cache = {}

    def remember(self, track_id):
        return self.cache.get(track_id, False)

class PlaybackState:
    pass
`;
    const workspace = workspaceFrom({ 'player.py': before }, 'player.py');
    const analysis = analyze(workspace);
    const position = positionOn(before, 'self.cache = {}');
    expect(adapter.planMoveField(
      workspace,
      analysis,
      'player.py',
      position,
      'PlaybackState'
    ).error).toContain('no existing self.<field> reference to PlaybackState');
    expect(api.computePythonActionAvailability(
      workspace,
      analysis,
      'player.py',
      position,
      null,
      'cache'
    )).toMatchObject({ moveField: false });
  });

  test('offers move field only on a simple self-field assignment', () => {
    const before = text`
class Player:
    def __init__(self, source):
        self.cache = {}
        self.expensive = source.build()
        local = {}

class PlaybackState:
    pass
`;
    const workspace = workspaceFrom({ 'player.py': before }, 'player.py');
    const analysis = analyze(workspace);
    expect(api.computePythonActionAvailability(
      workspace,
      analysis,
      'player.py',
      positionOn(before, 'cache ='),
      null,
      'cache'
    )).toMatchObject({
      rename: true,
      extract: false,
      parameterObject: false,
      moveMethod: false,
      moveField: true,
    });
    expect(api.computePythonActionAvailability(
      workspace,
      analysis,
      'player.py',
      positionOn(before, 'expensive ='),
      null,
      'expensive'
    )).toMatchObject({ moveField: false });
    expect(api.computePythonActionAvailability(
      workspace,
      analysis,
      'player.py',
      positionOn(before, 'local ='),
      null,
      'local'
    )).toMatchObject({ moveField: false });
  });

  test('offers move field when the self-field target or full line is selected', () => {
    const before = text`
class Player:
    def __init__(self):
        self.cache = {}
        self.volume = 75

class PlaybackState:
    pass
`;
    const workspace = workspaceFrom({ 'player.py': before }, 'player.py');
    const analysis = analyze(workspace);
    expect(api.computePythonActionAvailability(
      workspace,
      analysis,
      'player.py',
      positionOn(before, 'self.cache'),
      selectionAt(before, 'self.cache'),
      null
    )).toMatchObject({ moveField: true });

    expect(api.computePythonActionAvailability(
      workspace,
      analysis,
      'player.py',
      positionOn(before, 'self.cache'),
      selectionAt(before, '        self.cache = {}'),
      null
    )).toMatchObject({ moveField: true });
  });

  test('moves a field across files into an existing target constructor', () => {
    const player = text`
class Player:
    def __init__(self):
        self.cache = {}
        self.volume = 75
`;
    const state = text`
class PlaybackState:
    def __init__(self):
        self.started = False
`;
    const workspace = workspaceFrom({ 'player.py': player, 'state.py': state }, 'player.py');
    const analysis = analyze(workspace);
    const plan = adapter.planMoveField(
      workspace,
      analysis,
      'player.py',
      positionOn(player, 'self.cache'),
      'PlaybackState'
    );
    expect(plan.error).toBeFalsy();
    const applied = applyPlan(workspace, plan);
    expect(applied['player.py']).toBe(text`
class Player:
    def __init__(self):
        self.volume = 75
`);
    expect(applied['state.py']).toBe(text`
class PlaybackState:
    def __init__(self):
        self.started = False
        self.cache = {}
`);
  });

  test('move field refuses non-init, duplicate, dataclass, slots, and property hazards', () => {
    const nonInit = text`
class Player:
    def configure(self):
        self.cache = {}

class PlaybackState:
    pass
`;
    let workspace = workspaceFrom({ 'player.py': nonInit }, 'player.py');
    let analysis = analyze(workspace);
    expect(adapter.planMoveField(
      workspace,
      analysis,
      'player.py',
      positionOn(nonInit, 'self.cache'),
      'PlaybackState'
    ).error).toContain('__init__');

    const duplicate = text`
class Player:
    def __init__(self):
        self.cache = {}

    def reset(self):
        self.cache = {}

class PlaybackState:
    pass
`;
    workspace = workspaceFrom({ 'player.py': duplicate }, 'player.py');
    analysis = analyze(workspace);
    expect(adapter.planMoveField(
      workspace,
      analysis,
      'player.py',
      positionOn(duplicate, 'self.cache = {}'),
      'PlaybackState'
    ).error).toContain('exactly one');

    const dataclassSource = text`
from dataclasses import dataclass

@dataclass
class Player:
    cache: dict

    def __init__(self):
        self.cache = {}

class PlaybackState:
    pass
`;
    workspace = workspaceFrom({ 'player.py': dataclassSource }, 'player.py');
    analysis = analyze(workspace);
    expect(adapter.planMoveField(
      workspace,
      analysis,
      'player.py',
      positionOn(dataclassSource, 'self.cache'),
      'PlaybackState'
    ).error).toContain('dataclasses');

    const slots = text`
class Player:
    __slots__ = ("cache",)

    def __init__(self):
        self.cache = {}

class PlaybackState:
    pass
`;
    workspace = workspaceFrom({ 'player.py': slots }, 'player.py');
    analysis = analyze(workspace);
    expect(adapter.planMoveField(
      workspace,
      analysis,
      'player.py',
      positionOn(slots, 'self.cache'),
      'PlaybackState'
    ).error).toContain('__slots__');

    const property = text`
class Player:
    def __init__(self):
        self.cache = {}

    @property
    def label(self):
        return "player"

class PlaybackState:
    pass
`;
    workspace = workspaceFrom({ 'player.py': property }, 'player.py');
    analysis = analyze(workspace);
    expect(adapter.planMoveField(
      workspace,
      analysis,
      'player.py',
      positionOn(property, 'self.cache'),
      'PlaybackState'
    ).error).toContain('properties');
  });

  test('preview diff hunks show localized line changes for full-file edits', () => {
    const oldText = text`
line 1
line 2
line 3 old
line 4
line 5
line 6
line 7
line 8 old
line 9
line 10
`;
    const newText = text`
line 1
line 2
line 3 new
line 4
line 5
line 6
line 7
line 8 new
line 9
line 10
`;
    const hunks = api.buildLineDiffHunks(oldText, newText, 1, 1);
    expect(hunks).toHaveLength(2);
    expect(hunks[0].rows.map((row) => [row.kind, row.text])).toEqual([
      ['context', 'line 2'],
      ['old', 'line 3 old'],
      ['new', 'line 3 new'],
      ['context', 'line 4'],
    ]);
    expect(hunks[1].rows.map((row) => [row.kind, row.text])).toEqual([
      ['context', 'line 7'],
      ['old', 'line 8 old'],
      ['new', 'line 8 new'],
      ['context', 'line 9'],
    ]);
    const renderedTexts = hunks.flatMap((hunk) => hunk.rows.map((row) => row.text));
    expect(renderedTexts).not.toContain('line 1');
    expect(renderedTexts).not.toContain('line 10');
  });

  test('extract preview diff treats the extracted block as removed and helper as added', () => {
    const before = text`
"""The track catalog: add a new track to the library."""
from typing import Dict, List


# The library is a list of dicts. Pretend this is a database.
LIBRARY: List[Dict] = []


def add_track(title, artist, album, duration_sec, genre, release_year, bpm, isrc):
    """Insert a new track into the library."""
    record = {
        "title": title,
        "artist": artist,
        "album": album,
        "duration_sec": duration_sec,
        "genre": genre,
        "release_year": release_year,
        "bpm": bpm,
        "isrc": isrc,
    }
    LIBRARY.append(record)
    return record
`;
    const workspace = workspaceFrom({ 'track.py': before }, 'track.py');
    const analysis = analyze(workspace);
    const plan = adapter.planExtract(
      workspace,
      analysis,
      'track.py',
      selectionBetween(before, 'record = {', '    }'),
      'extracted_code'
    );
    expect(plan.error).toBeFalsy();
    expect(plan.edits).toHaveLength(2);
    expect(applyPlan(workspace, plan)['track.py']).toBe(text`
"""The track catalog: add a new track to the library."""
from typing import Dict, List


# The library is a list of dicts. Pretend this is a database.
LIBRARY: List[Dict] = []


def add_track(title, artist, album, duration_sec, genre, release_year, bpm, isrc):
    """Insert a new track into the library."""
    record = extracted_code(title, artist, album, duration_sec, genre, release_year, bpm, isrc)
    LIBRARY.append(record)
    return record

def extracted_code(title, artist, album, duration_sec, genre, release_year, bpm, isrc):
    record = {
        "title": title,
        "artist": artist,
        "album": album,
        "duration_sec": duration_sec,
        "genre": genre,
        "release_year": release_year,
        "bpm": bpm,
        "isrc": isrc,
    }
    return record
`);
    const hunks = api.buildPreviewFileHunks('track.py', plan.edits, workspace, 3);
    const rows = hunks.flatMap((hunk) => hunk.rows.map((row) => [row.kind, row.text]));
    expect(rows).toContainEqual([
      'old',
      '    record = {',
    ]);
    expect(rows).toContainEqual([
      'new',
      '    record = extracted_code(title, artist, album, duration_sec, genre, release_year, bpm, isrc)',
    ]);
    expect(rows).toContainEqual([
      'new',
      'def extracted_code(title, artist, album, duration_sec, genre, release_year, bpm, isrc):',
    ]);
    expect(rows).not.toContainEqual([
      'context',
      '    record = {',
    ]);
  });

  test('refactoring UI palette keeps readable contrast in light and dark mode', () => {
    const pairs = [
      ['light text', '#111827', '#ffffff'],
      ['light muted', '#4b5563', '#ffffff'],
      ['light primary button', '#ffffff', '#2774ae'],
      ['light removed diff', '#7f1d1d', '#fff1f2'],
      ['light added diff', '#064e3b', '#ecfdf5'],
      ['dark text', '#f8fafc', '#111827'],
      ['dark muted', '#cbd5e1', '#111827'],
      ['dark primary button', '#082f49', '#7dd3fc'],
      ['dark removed diff', '#fecaca', '#451a1a'],
      ['dark added diff', '#bbf7d0', '#052e24'],
    ];
    for (const [name, foreground, background] of pairs) {
      expect(contrastRatio(foreground, background), name).toBeGreaterThanOrEqual(4.5);
    }
  });
});
