'use strict';

// Suggested learner edits, shared by the content checks and browser exercises.
const sharedEdits = {
  message_order: code => code.replace(/payment\.(authorize|refund)\(\)/g,
    (_, method) => `payment.${method === 'authorize' ? 'refund' : 'authorize'}()`),
  message_receivers: code => code.replace('selected = indoor', 'selected = outdoor')
};

module.exports = {
  python: {
    ...sharedEdits,
    visibility: code => code.replace('def display_name(', 'def _display_name('),
    dependency: code => code.replace('self.roster = roster', 'pass'),
    removeParameter: code => code.replace(', roster: Roster', ''),
    inheritance: code => code.replace('class Puppy(Animal):', 'class Puppy(Dog):'),
    collection_multiplicity: code => code.replaceAll('members: Member', 'members: list[Member]'),
    self_calls: code => code.replace('self.validate()', 'self.save()')
      .replace('def save(self) -> None:\n        pass', 'def save(self) -> None:\n        self.validate()'),
    alternatives: code => code.replace('else:', 'if accepted:'),
    loop_boundary: code => code.replace('\nreceipt.finish()', '\n    receipt.finish()')
  },
  java: {
    ...sharedEdits,
    visibility: code => code.replace('public String displayName', 'private String displayName'),
    dependency: code => code.replace('private Roster roster;', '').replace('this.roster = roster;', ''),
    removeParameter: code => code.replace('Roster roster)', ')'),
    inheritance: code => code.replace('class Puppy extends Animal', 'class Puppy extends Dog'),
    collection_multiplicity: code => code.replaceAll('Member members', 'List<Member> members'),
    self_calls: code => code.replace('this.validate();', 'this.save();')
      .replace('void save() { }', 'void save() { this.validate(); }'),
    alternatives: code => code.replace('else {', 'if (accepted) {'),
    loop_boundary: code => code.replace('            receipt.addItem(item);\n        }\n        receipt.finish();',
      '            receipt.addItem(item);\n            receipt.finish();\n        }')
  },
  cpp: {
    ...sharedEdits,
    visibility: code => code.replace('public:', 'private:'),
    dependency: code => code.replace('Roster* roster = nullptr;', '').replace('this->roster = &roster;', ''),
    removeParameter: code => code.replace('Roster& roster)', ')'),
    inheritance: code => code.replace('class Puppy : public Animal', 'class Puppy : public Dog'),
    collection_multiplicity: code => code.replaceAll('Member&', 'std::vector<Member*>'),
    self_calls: code => code.replace('this->validate();', 'this->save();')
      .replace('void save() { }', 'void save() { this->validate(); }'),
    alternatives: code => code.replace('else {', 'if (accepted) {'),
    loop_boundary: code => code.replace('        receipt.addItem(item);\n    }\n    receipt.finish();',
      '        receipt.addItem(item);\n        receipt.finish();\n    }')
  }
};
