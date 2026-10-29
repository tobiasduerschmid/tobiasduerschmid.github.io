'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const yaml = require('js-yaml');

const tutorial = yaml.load(fs.readFileSync(path.resolve(__dirname, '../../_data/tutorials/observer-pattern.yml'), 'utf8'));
const pythonRunner = String.raw`
import contextlib, io, json, pathlib, sys
payload = json.load(sys.stdin)
for source in pathlib.Path('.').glob('*.py'):
    compile(source.read_text(), str(source), 'exec')
results = []
for check in payload:
    result = {'description': check['description'], 'passed': True}
    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            exec(check['command'], {'__name__': '__main__'})
    except Exception as error:
        result.update(passed=False, error=type(error).__name__, message=str(error))
    results.append(result)
print(json.dumps(results))
`;

function filesFor(number, version = 'solution') {
  const step = tutorial.steps[number - 1];
  const files = [...(step.files || []), ...(version === 'solution' ? step.solution?.files || [] : [])];
  return Object.fromEntries(files.map(file => [file.path, file.content]));
}

function grade(number, files = filesFor(number)) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'observer-grading-'));
  try {
    for (const [name, source] of Object.entries(files)) fs.writeFileSync(path.join(workspace, name), source);
    const result = spawnSync('python3', ['-c', pythonRunner], {
      cwd: workspace,
      input: JSON.stringify(tutorial.steps[number - 1].tests || []).replaceAll('/tutorial', workspace),
      encoding: 'utf8', timeout: 10_000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

function accepts(number, files) {
  assert.deepEqual(grade(number, files).filter(result => !result.passed), []);
}

function rejects(number, files, criterion) {
  const results = grade(number, files);
  const failed = results.filter(result => !result.passed && criterion.test(result.description));
  assert.ok(failed.length, `The incorrect attempt must fail ${criterion}: ${JSON.stringify(results)}`);
  assert.ok(failed.every(result => result.error === 'AssertionError'), JSON.stringify(failed));
}

function changed(number, filename, before, after) {
  const files = filesFor(number);
  assert.ok(files[filename].includes(before), 'The mutant must change a real source fragment.');
  files[filename] = files[filename].replace(before, after);
  return files;
}

for (const number of [1, 3, 4]) {
  test(`Observer step ${number}: the complete published solution passes`, () => accepts(number));
  test(`Observer step ${number}: the unfinished starter cannot complete the exercise`, () => {
    assert.ok(grade(number, filesFor(number, 'starter')).some(result => !result.passed));
  });
}

for (const number of [1, 4]) {
  const filename = number === 1 ? 'weather_station.py' : 'weather_observer.py';
  test(`Observer step ${number}: a constant heat result is rejected`, () => {
    rejects(number, changed(number, filename,
      'heat_index = temp - 0.55 * (1 - humidity / 100) * (temp - 58)', 'heat_index = 75.8'), /Heat display|Heat observer/);
  });
  test(`Observer step ${number}: an equivalent heat calculation and formatting pass`, () => {
    accepts(number, changed(number, filename,
      'heat_index = temp - 0.55 * (1 - humidity / 100) * (temp - 58)',
      'correction = (100 - humidity) * 0.0055 * (temp - 58)\n        heat_index = temp - correction'));
  });
}

test('Observer step 1 rejects disconnecting an existing display', () => {
  rejects(1, changed(1, 'weather_station.py', 'self.stats.show(temp, humidity, pressure)', 'pass'), /original three displays/);
});

test('Observer step 3 rejects a threshold hardcoded to the sample value', () => {
  rejects(3, changed(3, 'observer_basics.py', 'if temp > self.threshold:', 'if temp > 90:'), /above its configured/);
});

test('Observer step 3 rejects warning at equality', () => {
  rejects(3, changed(3, 'observer_basics.py', 'if temp > self.threshold:', 'if temp >= self.threshold:'), /at or below/);
});

test('Observer step 3 rejects dropping repeated readings', () => {
  rejects(3, changed(3, 'observer_basics.py', 'self.readings.append(temp)',
    'if temp not in self.readings:\n            self.readings.append(temp)'), /retains every reading/);
});

test('Observer step 3 rejects replacing a measurement with printed sample text', () => {
  rejects(3, changed(3, 'observer_basics.py', 'sensor.temperature = 68', 'print("68")'), /demonstration connects/);
});

test('Observer step 3 rejects notifying before the new temperature is stored', () => {
  const files = changed(3, 'observer_basics.py', 'self._temperature = value', 'self.notify()\n        self._temperature = value');
  files['observer_basics.py'] = files['observer_basics.py'].replace('print(f"\\nSensor: Temperature set to {value}°F")\n        self.notify()', 'print(f"\\nSensor: Temperature set to {value}°F")');
  rejects(3, files, /completed temperature assignment/);
});

test('Observer step 4 rejects a forecast that ignores changing pressure', () => {
  rejects(4, changed(4, 'weather_observer.py', 'pressure = station.pressure', 'pressure = 1013.25'), /falling pressure/);
});

test('Observer step 4 rejects a forecast that never retains the previous reading', () => {
  rejects(4, changed(4, 'weather_observer.py', 'self._last_pressure = pressure', 'pass'), /falling pressure|unchanged pressure/);
});

test('Observer step 4 rejects omitting the client-side detach', () => {
  rejects(4, changed(4, 'weather_observer.py', 'station.detach(forecast)', 'pass'), /ends the forecast subscription/);
});

test('Observer step 4 rejects stale score notification', () => {
  rejects(4, changed(4, 'bug_hunt.py', 'self._home = home\n        self._away = away\n        self.notify()',
    'self.notify()\n        self._home = home\n        self._away = away'), /complete new home/);
});

test('Observer step 4 rejects constant mobile messages', () => {
  rejects(4, changed(4, 'bug_hunt.py', 'msg = f"Score update: {subject.home}-{subject.away}"',
    'msg = "Score update: 2-1"'), /Mobile alerts retain/);
});

test('Observer step 4 rejects an unregistered mobile observer', () => {
  rejects(4, changed(4, 'bug_hunt.py', 'board.attach(mobile)', 'pass'), /registers both dependent/);
});

// These implementations are written independently of the model's method bodies.
// Keeping their public contract while changing storage updates/control flow must pass.
const alternativeObservers = `
class TemperatureLogger(Observer):
    def __init__(self):
        self.readings = []
    def update(self, subject):
        reading = subject.temperature
        self.readings += [reading]
        print('Logger: Recorded {}°F'.format(reading))

class TemperatureAlert(Observer):
    def __init__(self, threshold=90):
        self.threshold = threshold
    def update(self, subject):
        reading = subject.temperature
        if reading <= self.threshold:
            print('Alert: {}°F is within safe range'.format(reading))
            return
        print('ALERT: Temperature {}°F exceeds {}°F!'.format(reading, self.threshold))

def main():
    subject = TemperatureSensor()
    for dependent in [TemperatureAlert(90), TemperatureLogger()]:
        subject.attach(dependent)
    for reading in (72, 95, 68):
        subject.temperature = reading
`;

test('Observer step 3 accepts independent observers with early return and list concatenation', () => {
  const files = filesFor(3);
  files['observer_basics.py'] += alternativeObservers;
  accepts(3, files);
});

test('Observer step 3 accepts a second independent logging and alert formulation', () => {
  const files = filesFor(3);
  files['observer_basics.py'] += alternativeObservers.replace('self.readings += [reading]', 'self.readings.extend([reading])')
    .replace(`        if reading <= self.threshold:
            print('Alert: {}°F is within safe range'.format(reading))
            return
        print('ALERT: Temperature {}°F exceeds {}°F!'.format(reading, self.threshold))`,
    `        message = ('ALERT: Temperature {}°F exceeds {}°F!' if reading > self.threshold else 'Alert: {}°F is within safe range')
        print(message.format(reading, self.threshold))`);
  accepts(3, files);
});

test('Observer step 4 accepts independent forecasts and client wiring', () => {
  const files = filesFor(4);
  files['weather_observer.py'] += `
class ForecastDisplay(Observer):
    def __init__(self):
        self.previous = 0.0
    def update(self, station):
        current = station.pressure
        outlook = 'More of the same'
        if current != self.previous:
            outlook = 'Improving weather!' if current > self.previous else 'Cooler, rainy weather'
        print('[Forecast]', outlook)
        self.previous = current

class HeatIndexDisplay(Observer):
    def update(self, station):
        correction = 0.0055 * (100 - station.humidity) * (station.temperature - 58)
        print('[Heat] Heat Index: {:.1f}°F'.format(station.temperature - correction))

def main():
    weather = WeatherStation()
    forecast = ForecastDisplay()
    for view in (HeatIndexDisplay(), CurrentDisplay(), forecast, StatisticsDisplay()):
        weather.attach(view)
    for reading in [(80, 65, 1013.25), (82, 70, 1012.50), (78, 90, 1015.00)]:
        weather.new_measurement(*reading)
    weather.detach(forecast)
    weather.new_measurement(75, 60, 1011.00)
`;
  accepts(4, files);
});

test('Observer step 3 shows partial progress and accepts a focused alert correction', () => {
  const files = filesFor(3);
  files['observer_basics.py'] += '\nclass TemperatureAlert(Observer):\n    def __init__(self, threshold=90):\n        self.threshold = threshold\n    def update(self, subject):\n        pass\n';
  const results = grade(3, files);
  assert.ok(results.filter(result => /Registered observers|Logger/.test(result.description)).every(result => result.passed));
  assert.ok(results.filter(result => /Alert classifies/.test(result.description)).every(result => !result.passed));
  accepts(3);
});

test('Observer step 4 grades the mobile-message repair independently of score timing', () => {
  const files = filesFor(4, 'starter');
  files['weather_observer.py'] = filesFor(4)['weather_observer.py'];
  files['bug_hunt.py'] = files['bug_hunt.py'].replace('msg = f"Score update: 0-0"', 'msg = f"Score update: {subject.home}-{subject.away}"');
  const results = grade(4, files);
  assert.equal(results.find(result => /Mobile alerts retain/.test(result.description)).passed, true);
  assert.equal(results.find(result => /complete new home/.test(result.description)).passed, false);
  assert.equal(results.find(result => /registers both dependent/.test(result.description)).passed, false);
});

function matchingHints(check, source) {
  const code = source.replace(/#.*$/gm, '');
  return check.hints.flatMap((hint, index) => {
    const parsed = hint.condition.match(/^(code_matches|code_not_matches): \/(.+)\/([a-z]*)$/);
    assert.ok(parsed, 'Observer guidance uses supported source conditions.');
    const matches = new RegExp(parsed[2], parsed[3]).test(code);
    return (parsed[1] === 'code_matches' ? matches : !matches) ? [index] : [];
  });
}

const hintCases = [
  [1, /Heat display/, 'class HeatIndexDisplay:\n    def show(self, temp, humidity, pressure):\n', 'print(75)', 'print(humidity)'],
  [1, /Every new measurement/, 'class WeatherStation:\n    def new_measurement(self, temp, humidity, pressure):\n', 'self.current.show(temp, humidity, pressure)', 'self.heat.show(temp, humidity, pressure)'],
  [3, /Registered observers/, 'class TemperatureSensor:\n    def temperature(self, value):\n', 'self.notify()', 'self._temperature = value\n        self.notify()'],
  [3, /Logger retains/, 'class TemperatureLogger:\n    def update(self, subject):\n', 'print(72)', 'print(subject.temperature)'],
  [3, /Alert classifies/, 'class TemperatureAlert:\n    def update(self, subject):\n', 'print("ALERT")', 'print(self.threshold)'],
  [3, /demonstration connects/, 'def main():\n', 'sensor = TemperatureSensor()', 'sensor = TemperatureSensor()\n        sensor.attach(observer)'],
  [4, /Forecast reports rising/, 'class ForecastDisplay:\n    def update(self, station):\n', 'print("[Forecast]")', 'print(self._last_pressure)'],
  [4, /complete new home/, 'class ScoreBoard:\n    def update_score(self, home, away):\n', 'self.notify()', 'self._away = away\n        self.notify()'],
  [4, /Mobile alerts retain/, 'class MobileAlert:\n    def update(self, subject):\n', 'print("0-0")', 'print(subject.home)'],
];

for (const [number, criterion, header, partial, developed] of hintCases) {
  test(`Observer step ${number}: ${criterion} guidance follows the assessed definition`, () => {
    const check = tutorial.steps[number - 1].tests.find(candidate => criterion.test(candidate.description));
    assert.ok(check, `Expected a criterion matching ${criterion}.`);
    assert.deepEqual(matchingHints(check, header + '        pass\n'), [0]);
    assert.deepEqual(matchingHints(check, header + '        ' + partial + '\n'), [1]);
    assert.deepEqual(matchingHints(check, header + '        ' + developed + '\n'), [2]);
    assert.deepEqual(matchingHints(check, '# ' + header + '\ndef unrelated():\n    print("sample")\n'), [0]);
  });
}

test('Observer weather wiring hints are not advanced by the separate score-board main', () => {
  const step = tutorial.steps[3];
  const check = step.tests.find(candidate => /weather demonstration keeps/.test(candidate.description));
  const unrelated = 'def main():\n    board = ScoreBoard()\n    board.attach(mobile)\n';
  assert.deepEqual(matchingHints(check, unrelated), [0]);
  assert.deepEqual(matchingHints(check, unrelated + '\ndef main():\n    weather = WeatherStation()\n'), [1]);
});

test('Observer step 3 rejects a threshold hardcoded to the grader example', () => {
  rejects(3, changed(3, 'observer_basics.py', 'if temp > self.threshold:', 'if temp > 80:'), /at or below/);
});

test('Observer step 3 accepts observers that validate the concrete sensor type', () => {
  const files = filesFor(3);
  files['observer_basics.py'] = files['observer_basics.py'].replaceAll('temp = subject.temperature',
    'assert isinstance(subject, TemperatureSensor)\n        temp = subject.temperature');
  accepts(3, files);
});

test('Observer step 4 accepts observers that validate their concrete subject type', () => {
  const files = filesFor(4);
  files['weather_observer.py'] = files['weather_observer.py']
    .replace('pressure = station.pressure', 'assert isinstance(station, WeatherStation)\n        pressure = station.pressure')
    .replace('temp = station.temperature', 'assert isinstance(station, WeatherStation)\n        temp = station.temperature');
  files['bug_hunt.py'] = files['bug_hunt.py'].replace('msg = f"Score update:',
    'assert isinstance(subject, ScoreBoard)\n        msg = f"Score update:');
  accepts(4, files);
});

test('Observer step 3 rejects manual demonstration callbacks without subscriptions', () => {
  const files = filesFor(3);
  files['observer_basics.py'] += `
def main():
    sensor = TemperatureSensor()
    logger = TemperatureLogger()
    alert = TemperatureAlert(threshold=90)
    for reading in [72, 95, 68]:
        sensor.temperature = reading
        logger.update(sensor)
        alert.update(sensor)
`;
  rejects(3, files, /demonstration connects/);
});

test('Observer step 4 rejects manual display calls and a conditional forecast skip', () => {
  const files = filesFor(4);
  files['weather_observer.py'] += `
def main():
    station = WeatherStation()
    displays = [CurrentDisplay(), StatisticsDisplay(), ForecastDisplay(), HeatIndexDisplay()]
    for values in [(80, 65, 1013.25), (82, 70, 1012.50), (78, 90, 1015.00), (75, 60, 1011.00)]:
        station.new_measurement(*values)
        for display in displays:
            if values[0] != 75 or not isinstance(display, ForecastDisplay):
                display.update(station)
`;
  rejects(4, files, /weather demonstration/);
});

test('Observer step 3 permits explicit cleanup after the required demonstration', () => {
  const files = changed(3, 'observer_basics.py', 'sensor.temperature = 68',
    'sensor.temperature = 68\n    sensor.detach(logger)\n    sensor.detach(alert)');
  accepts(3, files);
});

test('Observer step 4 rejects manual score callbacks without registrations', () => {
  const files = filesFor(4);
  files['bug_hunt.py'] += `
def main():
    board = ScoreBoard()
    tv = TVOverlay()
    mobile = MobileAlert()
    for home, away in [(1, 0), (1, 1), (2, 1)]:
        board.update_score(home, away)
        tv.update(board)
        mobile.update(board)
`;
  rejects(4, files, /score demonstration registers/);
});
