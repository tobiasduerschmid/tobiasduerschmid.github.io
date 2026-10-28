const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const yaml = require('js-yaml');
const root = path.resolve(__dirname, '../..');
const homework = yaml.load(fs.readFileSync(path.join(root, '_data/tutorials/monopoly-state-pattern-uml.yml'), 'utf8'));
const sandbox = { document: { readyState: 'loading', addEventListener() {}, documentElement: {} }, MutationObserver: class { observe() {} } };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/ArchUML/uml-bundle.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/tutorial-uml-editor.js'), 'utf8'), sandbox);

const diagrams = require('../../tests/fixtures/monopoly-uml');

// Exercise the production grading entry point; only DOM presentation is replaced.
function grade(type, source = diagrams[type], overrides = {}) {
  const editor = new sandbox.UMLTutorialEditor(null, { steps: homework.steps });
  editor.currentStep = homework.steps.findIndex(step => step.uml_type === type);
  editor.currentSource = () => source;
  editor.sourceForDiagramType = name => ({ ...diagrams, ...overrides })[name];
  editor.renderNav = editor.renderControls = editor._showTestPanel = editor._announceTestResult = () => {};
  let report;
  editor._buildTestResultsHTML = (rows, results) => { report = rows.map((row, i) => ({ ...row, pass: results[i] })); return ''; };
  editor.runTests();
  return report;
}
function passes(type, source, overrides) {
  const failures = grade(type, source, overrides).filter(row => !row.pass);
  assert.equal(failures.length, 0, JSON.stringify(failures));
}
function rejects(type, source, overrides) {
  assert.ok(grade(type, source, overrides).some(row => !row.pass), 'An invalid submission must receive a failed criterion');
}
const insert = (source, text) => source.replace('@enduml', text + '\n@enduml');
// What the visual editor writes once a student drags declarations or bends a route.
function arrangedByEditor(source) {
  let x = 0;
  const pinned = source.replace(/^(?:class|interface|state|participant) \S+(?:: \S+)?/gm, head => `${head} @pos(${x += 120}, 40)`);
  return pinned.replace('@startuml\n', '@startuml\n@layout schema=1 renderer="archuml-visual-editor"\nedge "rel:6" points="40,40 40,120 160,120"\n@endlayout\n');
}
const abstractDesign = diagrams.class.replace('interface PlayerState', 'abstract class PlayerState').replace('PlayerState { +takeTurn', 'PlayerState { +{abstract} takeTurn').replaceAll('..|>', '--|>');

for (const type of ['class', 'state', 'sequence']) test('accepts the complete ' + type + ' baseline', () => passes(type));
for (const type of ['class', 'state', 'sequence']) {
  test(type + ' grades ignore positions and route bends saved by the visual editor', () => passes(type, arrangedByEditor(diagrams[type])));
}
test('later steps read an arranged class and state diagram', () => {
  const arranged = { class: arrangedByEditor(diagrams.class), state: arrangedByEditor(diagrams.state) };
  passes('state', diagrams.state, arranged);
  passes('sequence', diagrams.sequence, arranged);
});
test('arranging a wrong class diagram does not hide its error', () => rejects('class', arrangedByEditor(diagrams.class.replace('Player o--', 'Player --o'))));
for (const [name, source] of [
  ['a consistently renamed abstraction', diagrams.class.replaceAll('PlayerState', 'TurnBehavior')],
  ['a consistently renamed turn operation', diagrams.class.replaceAll('takeTurn', 'advanceTurn')],
  ['a consistently renamed state-changing operation', diagrams.class.replaceAll('setState', 'adopt')],
  ['inherited realization through an abstract base', insert(diagrams.class.replaceAll('..|> PlayerState', '--|> StateBase'), 'abstract class StateBase\nStateBase ..|> PlayerState')],
  ['concrete helper methods inherited from an abstract class', abstractDesign.replace('): void; }', '): void; +describe(): String; }')],
  ['explicit abstract turn operations', abstractDesign],
  ['interface relationships normalized by the editor', diagrams.class.replaceAll('..|>', '--|>')],
  ['equivalent reversed ownership and realization', diagrams.class.replace('Player o-- "1" PlayerState', 'PlayerState "1" --o Player').replace(/(NormalState|JailState|BankruptState) \.\.\|> PlayerState/g, 'PlayerState <|.. $1')],
  ['an unrelated helper before the State classes', diagrams.class.replace('class NormalState', 'class NormalDistribution\nclass NormalState')]
]) test('class accepts ' + name, () => passes('class', source));

for (const [name, source] of [
  ['one class standing in for three concrete states', diagrams.class.replace(/class (NormalState|JailState|BankruptState).*\n/g, '').replace(/(NormalState|JailState|BankruptState) \.\.\|> PlayerState\n/g, '').replace('@enduml', 'class NormalJailBankruptState { +takeTurn(player: Player): void; }\nNormalJailBankruptState ..|> PlayerState\n@enduml')],
  ['abstract classes standing in for concrete states', diagrams.class.replace(/class (NormalState|JailState|BankruptState)/g, 'abstract class $1')],
  ['incompatible overriding parameters', abstractDesign.replace(/class (NormalState|JailState|BankruptState) \{.*\}/g, 'class $1 { +takeTurn(dice: Dice, balance: Money): int; }')],
  ['incompatible overriding return types', abstractDesign.replace(/class (NormalState|JailState|BankruptState) \{.*\}/g, 'class $1 { +takeTurn(player: Player): int; }')],
  ['concrete turn operation on an abstract abstraction', abstractDesign.replace('{abstract} ', '')],
  ['missing concrete turn implementation', diagrams.class.replace('class JailState { +takeTurn(player: Player): void; }', 'class JailState')],
  ['realization targeting a class', diagrams.class.replace('interface PlayerState', 'abstract class PlayerState').replace('PlayerState { +takeTurn', 'PlayerState { +{abstract} takeTurn')],
  ['wrong ownership diamond end', diagrams.class.replace('Player o--', 'Player --o')],
  ['multiple current states', diagrams.class.replace('"1"', '"*"')],
  ['role words only in unrelated operation parameters', diagrams.class.replace('class Player { +takeTurn(); +setState(state: PlayerState); }', 'class Player { +record(takeTurn: String); +inspect(setState: PlayerState); }').replaceAll('takeTurn(player: Player): void', 'log(takeTurn: String): void')]
]) test('class rejects ' + name, () => rejects('class', source));

test('helper declaration order does not change behavioral grades', () => {
  const classSource = diagrams.class.replace('class NormalState', 'class NormalDistribution\nclass NormalState');
  passes('state', diagrams.state, { class: classSource });
  passes('sequence', diagrams.sequence, { class: classSource });
});
test('state accepts a concise condition', () => passes('state', diagrams.state.replace('fee paid', 'pay')));
test('state rejects an unlabeled duplicate transition', () => rejects('state', insert(diagrams.state, 'NormalState --> JailState')));
test('state note text does not count as transitions', () => rejects('state', diagrams.state.replace('NormalState --> JailState', 'note right of NormalState\nNormalState --> JailState').replace('@enduml', 'end note\n@enduml')));
test('sequence note text does not count as calls', () => rejects('sequence', diagrams.sequence.replace('player -> normal', 'note over player\nplayer -> normal').replace('@enduml', 'end note\n@enduml')));
test('class note text does not count as classes', () => rejects('class', '@startuml\nclass Example\nnote right of Example\n' + diagrams.class.replace('@startuml\n', '').replace('@enduml', 'end note\n@enduml')));
test('sequence accepts equivalent leftward calls', () => passes('sequence', diagrams.sequence.replace('player -> normal', 'normal <- player').replace('normal -> player', 'player <- normal').replace('player -> jail', 'jail <- player')));
test('return-only sequence cannot satisfy required calls', () => rejects('sequence', diagrams.sequence.replaceAll(' -> ', ' --> ')));
test('a response cannot substitute for a state change', () => rejects('sequence', diagrams.sequence.replace('normal -> player', 'normal --> player')));
test('real calls can be interleaved with response messages', () => passes('sequence', diagrams.sequence.replace('normal -> player: setState(jail)', 'normal --> player: done\nnormal -> player: setState(jail)')));
test('sequence names inferred from the class design remain accepted', () => passes('sequence', diagrams.sequence.replaceAll('takeTurn', 'advanceTurn').replaceAll('setState', 'adopt'), { class: diagrams.class.replaceAll('takeTurn', 'advanceTurn').replaceAll('setState', 'adopt') }));
test('sequence permits unused contextual lifelines', () => passes('sequence', diagrams.sequence.replace('participant player: Player', 'participant observer: Player\nparticipant player: Player\nparticipant bankrupt: BankruptState')));
test('sequence rejects a wrong argument count', () => rejects('sequence', diagrams.sequence.replaceAll('takeTurn(player)', 'takeTurn(17, true, player)')));
test('sequence rejects a known incompatible lifeline argument type', () => rejects('sequence', diagrams.sequence.replaceAll('takeTurn(player)', 'takeTurn(jail)')));
test('sequence must follow a transition in the saved state model', () => rejects('sequence', diagrams.sequence, { state: diagrams.state.replace('NormalState --> JailState : third double\n', '') }));
test('sequence state lifelines must occur in the saved state diagram', () => rejects('sequence', diagrams.sequence, { state: '@startuml\n@enduml' }));
test('next turn must use the newly assigned state object', () => rejects('sequence', diagrams.sequence.replace('player -> jail: takeTurn(player)', 'player -> normal: takeTurn(player)\nplayer -> jail: takeTurn(player)')));
test('a valid prefix cannot hide a later inconsistent state change', () => rejects('sequence', insert(diagrams.sequence, 'jail -> player: setState(normal)\nplayer -> jail: takeTurn(player)')));
test('two distinct instances of the same class are not interchangeable', () => rejects('sequence', diagrams.sequence.replace('participant jail: JailState', 'participant jail: JailState\nparticipant otherJail: JailState').replace('setState(jail)', 'setState(otherJail)')));
test('a class name is not an object argument', () => rejects('sequence', diagrams.sequence.replace('setState(jail)', 'setState(JailState)')));
test('mutually exclusive operands cannot assemble one interaction', () => rejects('sequence', diagrams.sequence.replace('player -> normal', 'alt first turn\nplayer -> normal').replace('normal -> player', 'else second turn\nnormal -> player').replace('@enduml', 'end\n@enduml')));
test('a complete interaction inside an alternative is accepted', () => passes('sequence', diagrams.sequence.replace('player -> normal', 'alt enter jail\nplayer -> normal').replace('@enduml', 'else remain normal\nplayer -> normal: takeTurn(player)\nend\n@enduml')));
test('a common prefix and suffix can surround alternatives', () => passes('sequence', diagrams.sequence.replace('normal -> player: setState(jail)', 'alt third double\nnormal -> player: setState(jail)\nelse\nnormal -> player: setState(jail)\nend')));
test('inconsistent paths cannot be hidden by another valid alternative', () => rejects('sequence', diagrams.sequence.replace('normal -> player: setState(jail)', 'alt enter jail\nnormal -> player: setState(jail)\nelse remain normal\nend')));

test('similarly spelled operations do not count as the declared operation', () => rejects('sequence', diagrams.sequence.replaceAll('takeTurn(player)', 'taketurn(player)')));
test('overloaded calls resolve the state parameter on the compatible signature', () => passes('sequence', diagrams.sequence.replace('setState(jail)', 'setState(42, jail)'), { class: diagrams.class.replace('+setState(state: PlayerState);', '+setState(state: PlayerState); +setState(reason: int, next: PlayerState);') }));
test('a loop can repeat a coherent state round trip', () => passes('sequence', diagrams.sequence.replace('player -> normal', 'loop turns\nplayer -> normal').replace('@enduml', 'jail -> player: setState(normal)\nend\n@enduml')));
test('a loop cannot silently reset the current object between iterations', () => rejects('sequence', diagrams.sequence.replace('player -> normal', 'loop turns\nplayer -> normal').replace('@enduml', 'end\n@enduml')));

test('other abstract collaborators do not obscure the state abstraction', () => passes('class', insert(diagrams.class, 'abstract class DiceSource { +roll(): int; }\nPlayer o-- "1" DiceSource')));
test('related declared types can be used in a UML operation redefinition', () => {
  const source = abstractDesign.replace('class NormalState { +takeTurn(player: Player): void; }', 'class NormalState { +takeTurn(player: ExperiencedPlayer): void; }');
  passes('class', insert(source, 'class ExperiencedPlayer\nExperiencedPlayer --|> Player'));
});

test('an alternative without else includes the no-match path', () => rejects('sequence', diagrams.sequence.replace('normal -> player: setState(jail)', 'alt enter jail\nnormal -> player: setState(jail)\nend')));
test('an output-only parameter cannot accept the next state object', () => rejects('class', diagrams.class.replace('setState(state: PlayerState)', 'setState(out state: PlayerState)')));

for (const other of ['Jail', 'j_ail']) test('distinct lifeline ID ' + other + ' cannot replace the assigned object', () => rejects('sequence', diagrams.sequence.replace('participant jail: JailState', 'participant jail: JailState\nparticipant ' + other + ': JailState').replace('player -> jail: takeTurn(player)', 'player -> ' + other + ': takeTurn(player)')));
test('an abstract redeclaration blocks an older inherited implementation', () => rejects('class', insert(diagrams.class.replace('class JailState { +takeTurn(player: Player): void; }', 'class JailState').replace('JailState ..|> PlayerState', 'JailState --|> SpecialState'), 'class StateBase { +takeTurn(player: Player): void; }\nabstract class SpecialState { +{abstract} takeTurn(player: Player): void; }\nSpecialState --|> StateBase\nStateBase ..|> PlayerState')));
test('a concrete redeclaration satisfies a re-abstracted operation', () => passes('class', insert(diagrams.class.replace('JailState ..|> PlayerState', 'JailState --|> SpecialState'), 'class StateBase { +takeTurn(player: Player): void; }\nabstract class SpecialState { +{abstract} takeTurn(player: Player): void; }\nSpecialState --|> StateBase\nStateBase ..|> PlayerState')));

const nestedBreak = diagrams.sequence.replace('normal -> player: setState(jail)', 'critical local interaction\nbreak skip local remainder\nnormal -> player: setState(jail)\nend\nplayer -> normal: takeTurn(player)\nend\nplayer -> normal: takeTurn(player)\nnormal -> player: setState(jail)');
test('a nested break resumes checks after its enclosing fragment', () => rejects('sequence', nestedBreak));
test('a nested break permits a coherent continuation outside its fragment', () => passes('sequence', diagrams.sequence.replace('normal -> player: setState(jail)', 'critical local interaction\nbreak change immediately\nnormal -> player: setState(jail)\nend\nnormal -> player: setState(jail)\nend')));
test('unsupported fragments request review even after a valid interaction', () => rejects('sequence', insert(diagrams.sequence, 'neg forbidden interaction\nplayer -> jail: takeTurn(player)\nend')));
for (const bound of ['(1)', '(1, 1)', '(0, 1)']) test('a loop respects bound ' + bound, () => passes('sequence', diagrams.sequence.replace('player -> normal', 'loop ' + bound + '\nplayer -> normal').replace('@enduml', 'end\n@enduml')));
test('a zero-iteration loop cannot supply a witness', () => rejects('sequence', diagrams.sequence.replace('player -> normal', 'loop (0)\nplayer -> normal').replace('@enduml', 'end\n@enduml')));
test('a two-iteration loop checks its second iteration', () => rejects('sequence', diagrams.sequence.replace('player -> normal', 'loop (2)\nplayer -> normal').replace('@enduml', 'end\n@enduml')));
test('a large bounded loop terminates using repeated abstract states', () => passes('sequence', diagrams.sequence.replace('player -> normal', 'loop (1000000000)\nplayer -> normal').replace('@enduml', 'jail -> player: setState(normal)\nend\n@enduml')));
test('an unconditional alternative has no skipped path', () => passes('sequence', diagrams.sequence.replace('normal -> player: setState(jail)', 'alt\nnormal -> player: setState(jail)\nend')));
test('multiple guarded alternatives without otherwise can all be skipped', () => rejects('sequence', diagrams.sequence.replace('normal -> player: setState(jail)', 'alt first reason\nnormal -> player: setState(jail)\nelse second reason\nnormal -> player: setState(jail)\nend')));
test('state names must match classifier names exactly', () => rejects('state', diagrams.state.replaceAll('JailState', 'jailstate')));
test('sequence type references must name the actual classifier', () => rejects('sequence', diagrams.sequence.replace('participant jail: JailState', 'participant jail: jailstate')));
test('a similarly spelled helper cannot obscure the declared turn operation', () => passes('class', diagrams.class.replace('class Player { +takeTurn();', 'class Player { +taketurn(); +takeTurn();')));
