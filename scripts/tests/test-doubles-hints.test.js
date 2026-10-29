const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const tutorial = yaml.load(fs.readFileSync(
  path.resolve(__dirname, '../../_data/tutorials/test-doubles.yml'), 'utf8'));

// These are authoring-data tests of the documented source-condition contract.
// Behavioral grader tests independently decide whether a submission earns credit.
function applicableHints(check, source) {
  return check.hints.filter(hint => {
    assert.ok(hint.condition, 'Support must respond to the current attempt');
    const match = hint.condition.match(/^(code|source)_(matches|not_matches|contains|missing):\s*(.+)$/);
    assert.ok(match, `Unsupported source condition: ${hint.condition}`);
    const [, scope, operation, pattern] = match;
    const text = scope === 'code' ? source.replace(/#.*$/gm, '') : source;
    if (operation === 'contains') return text.includes(pattern);
    if (operation === 'missing') return !text.includes(pattern);
    const slash = pattern.match(/^\/(.*)\/([a-z]*)$/);
    const regex = slash ? new RegExp(slash[1], slash[2]) : new RegExp(pattern);
    return regex.test(text) === (operation === 'matches');
  });
}

function sourceFor(step, replacements = []) {
  const files = new Map(step.files.map(file => [file.path, file.content || '']));
  replacements.forEach(file => files.set(file.path, file.content));
  return [...files.values()].join('\n');
}

for (const step of tutorial.steps) {
  for (const check of step.tests || []) {
    test(`${step.title}: ${check.description} offers focused help for missing and developed attempts`, () => {
      assert.equal(applicableHints(check, '').length, 1, 'A deleted target still gets useful orientation');
      assert.equal(applicableHints(check, sourceFor(step)).length, 1, 'The starter gets one relevant hint');
      assert.equal(applicableHints(check, sourceFor(step, step.solution?.files)).length, 1,
        'A developed attempt gets one relevant diagnostic, rather than the whole ladder');
    });
  }
}

const profiles = [
  {
    step: 0, check: 1, name: 'is_today_event_day',
    partial: 'def is_today_event_day(event_date_str: str, clock=datetime.datetime) -> bool:\n    return datetime.datetime.now().isoformat() == event_date_str\n',
    developed: 'def is_today_event_day(event_date_str: str, clock=datetime.datetime) -> bool:\n    return clock.now().strftime("%Y-%m-%d") != event_date_str\n',
  },
  {
    step: 2, check: 2, name: 'test_award_streak_bonus_5_days',
    partial: 'def test_award_streak_bonus_5_days():\n    service.award_streak_bonus("u2", 5)\n',
    developed: 'def test_award_streak_bonus_5_days():\n    service.award_streak_bonus("u2", 5)\n    assert len(spy.calls) >= 0\n',
  },
  {
    step: 3, check: 1, name: 'test_d_side_effect_simulates_api_failure',
    partial: 'def test_d_side_effect_simulates_api_failure():\n    result = service.daily_quest_title("u1")\n',
    developed: 'def test_d_side_effect_simulates_api_failure():\n    assert "No quests" in service.daily_quest_title("u1")\n',
  },
  {
    step: 4, check: 3, name: 'test_expected_ledger_verifies_quest_credit',
    partial: 'def test_expected_ledger_verifies_quest_credit():\n    service.complete_quest("u1", "Slay the Slime Lord")\n',
    developed: 'def test_expected_ledger_verifies_quest_credit():\n    service.complete_quest("u1", "Slay the Slime Lord")\n    ledger.verify()\n',
  },
  {
    step: 5, check: 9, name: 'test_released_album_announces',
    partial: 'def test_released_album_announces():\n    announce_release("user", "album", catalog, notifier)\n',
    developed: 'def test_released_album_announces():\n    assert announce_release("user", "album", catalog, notifier) is True\n',
  },
];

for (const profile of profiles) {
  const check = tutorial.steps[profile.step].tests[profile.check];
  const rung = source => applicableHints(check, source).map(hint => check.hints.indexOf(hint));
  test(`${profile.name}: hints distinguish an action from its verification without following unrelated examples`, () => {
    assert.deepEqual(rung(profile.partial), [1], 'A partial attempt gets a plan for its next decision');
    assert.deepEqual(rung(profile.developed), [2], 'An attempted verification gets a diagnostic challenge');
    const unrelated = profile.partial.replace(`def ${profile.name}(`, 'def unrelated_example(');
    const commented = profile.partial.split('\n').map(line => '# ' + line).join('\n');
    for (const distraction of [unrelated, commented]) {
      assert.deepEqual(rung(distraction), [0], 'An unrelated definition cannot stand in for the requested target');
      assert.deepEqual(rung(distraction + '\n' + profile.developed), [2]);
      assert.deepEqual(rung(profile.developed + '\n' + distraction), [2]);
    }
  });
}

test('the XP critique hint follows the reflection rather than assertions in the supplied tests', () => {
  const check = tutorial.steps[5].tests[0];
  const rung = source => applicableHints(check, source).map(hint => check.hints.indexOf(hint));
  assert.deepEqual(rung('"""The over-mocked version mocked: ___ FILL IN ___\nWhat that cost: ___ FILL IN ___"""'), [1]);
  assert.deepEqual(rung('"""The over-mocked version mocked: the calculator\nWhat that cost: less evidence about filtering"""'), [2]);
  assert.deepEqual(rung('def unrelated_example():\n    assert True\n'), [0]);
});
