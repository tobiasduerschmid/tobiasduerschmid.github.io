'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { analyzeCppSources } = require('../../js/uml-analyzer-cpp.js');

function infer(code, options) {
  const result = analyzeCppSources({ 'main.cpp': code }, options);
  assert.deepEqual(result.errors, [], 'valid teaching examples should analyze without errors');
  return result;
}

test('class and struct defaults, access sections, virtual methods and multiple inheritance', () => {
  const { classDiagram } = infer(`
    class Animal { public: virtual void speak() const = 0; virtual ~Animal() = default; };
    struct Tagged { int id; };
    class Dog final : public Animal, public Tagged {
      int age;
    protected: bool asleep;
    public: static int count; void speak() const override { };
    };
  `);
  assert.match(classDiagram, /abstract class Animal/);
  assert.match(classDiagram, /\{abstract\} \+speak\(\)/);
  assert.match(classDiagram, /\+~Animal\(\)/);
  assert.match(classDiagram, /\+id: int/);
  assert.match(classDiagram, /-age: int/);
  assert.match(classDiagram, /#asleep: bool/);
  assert.match(classDiagram, /\{static\} \+count: int/);
  assert.match(classDiagram, /Dog --\|> Animal/);
  assert.match(classDiagram, /Dog --\|> Tagged/);
});

test('C++ ownership and multiplicity distinguish values, references, pointers and standard containers', () => {
  const { classDiagram } = infer(`
    #include <memory>
    #include <vector>
    struct Value {}; struct Ref {}; struct Ptr {}; struct Owned {}; struct Shared {}; struct Item {};
    class Store {
      Value value;
      Ref& reference;
      Ptr* pointer;
      std::unique_ptr<Owned> owned;
      std::shared_ptr<Shared> shared;
      std::vector<Item> items;
    };
  `);
  assert.match(classDiagram, /Store "1" \*-- "1" Value/);
  assert.match(classDiagram, /Store --> "1" Ref/);
  assert.match(classDiagram, /Store --> "0\.\.1" Ptr/);
  assert.match(classDiagram, /Store "1" \*-- "0\.\.1" Owned/);
  assert.match(classDiagram, /Store o-- "0\.\.1" Shared/);
  assert.match(classDiagram, /Store "1" \*-- "\*" Item/);
});

test('parameter and return types remain dependencies when no field stores them', () => {
  const { classDiagram } = infer('struct Roster {}; struct Report {}; class Student { public: Report print(const Roster& roster); };');
  assert.match(classDiagram, /Student \.\.> Roster/);
  assert.match(classDiagram, /Student \.\.> Report/);
  assert.doesNotMatch(classDiagram, /Student .*--[>*o]/);
});

test('namespaces, aliases, templates and enums do not confuse distinct class identities', () => {
  const { classDiagram } = infer(`
    namespace first { struct Item {}; }
    namespace second { struct Item {}; using Entry = Item; struct Box { Entry value; }; }
    template<typename T> class Holder { T value; };
    enum class State { Idle, Busy = 2 };
  `);
  assert.match(classDiagram, /class first__Item/);
  assert.match(classDiagram, /class second__Item/);
  assert.match(classDiagram, /second__Box "1" \*-- "1" second__Item/);
  assert.doesNotMatch(classDiagram, /second__Box .* first__Item/);
  assert.match(classDiagram, /class Holder/);
  assert.match(classDiagram, /enum State \{\s*Idle\s*Busy\s*\}/);
});

test('header declarations merge with out-of-line definitions and main follows the actual object', () => {
  const result = analyzeCppSources({
    'sensor.hpp': '#pragma once\nclass Sensor { public: int read() const; };',
    'sensor.cpp': '#include "sensor.hpp"\nint Sensor::read() const { return 25; }',
    'main.cpp': '#include "sensor.hpp"\nint main() { Sensor sensor; int reading = sensor.read(); }'
  });
  assert.deepEqual(result.errors, []);
  assert.equal((result.classDiagram.match(/\+read\(\): int/g) || []).length, 1);
  assert.match(result.sequenceDiagram, /Main --> sensor: <<create>>/);
  assert.match(result.sequenceDiagram, /Main -> sensor: read\(\)/);
  assert.match(result.sequenceDiagram, /sensor --> Main: int/);
});

test('stack objects, heap construction, smart pointers and aliases use dot and arrow calls', () => {
  const { sequenceDiagram } = infer(`
    #include <memory>
    struct Worker { void run() {} };
    int main() {
      Worker first;
      Worker* second = new Worker();
      auto third = std::make_unique<Worker>();
      Worker& alias = first;
      first.run(); second->run(); third->run(); alias.run();
    }
  `);
  assert.match(sequenceDiagram, /Main -> first: run\(\)/);
  assert.match(sequenceDiagram, /Main -> second: run\(\)/);
  assert.match(sequenceDiagram, /Main -> third: run\(\)/);
  assert.equal((sequenceDiagram.match(/Main -> first: run\(\)/g) || []).length, 2);
  assert.doesNotMatch(sequenceDiagram, /participant alias/);
});

test('constructor injection and reference parameters preserve receiver identity', () => {
  const { sequenceDiagram } = infer(`
    struct Payment { void capture() {} };
    class Checkout {
      Payment& payment;
    public:
      Checkout(Payment& p) : payment(p) {}
      void submit() { this->validate(); payment.capture(); }
      void validate() {}
    };
    void finish(Payment& p) { p.capture(); }
    int main() { Payment payment; Checkout checkout(payment); checkout.submit(); finish(payment); }
  `);
  assert.match(sequenceDiagram, /checkout -> checkout: validate\(\)/);
  assert.match(sequenceDiagram, /checkout -> payment: capture\(\)/);
  assert.match(sequenceDiagram, /Main -> payment: capture\(\)/);
  assert.doesNotMatch(sequenceDiagram, /participant p:/);
});

test('branch and loop fragments contain the calls controlled by them', () => {
  const { sequenceDiagram } = infer(`
    struct Worker {
      void accept() {} void reject() {} void tick() {} void finish() {}
      void run(bool okay) {
        if (okay) accept(); else reject();
        for (int i = 0; i < 3; ++i) { tick(); }
        finish();
      }
    };
    int main() { Worker w; w.run(true); }
  `);
  assert.match(sequenceDiagram, /alt \[okay\][\s\S]*w -> w: accept\(\)[\s\S]*else[\s\S]*w -> w: reject\(\)[\s\S]*end/);
  assert.match(sequenceDiagram, /loop \[for[\s\S]*w -> w: tick\(\)[\s\S]*end\s+w -> w: finish\(\)/);
});

test('inherited methods, static calls and overloads by arity retain their bodies', () => {
  const { sequenceDiagram } = infer(`
    struct Base { void inherited() {} };
    struct Worker : Base {
      static void boot() {}
      void run() { inherited(); }
      void run(int count) { this->tick(); }
      void tick() {}
    };
    int main() { Worker w; Worker::boot(); w.run(); w.run(2); }
  `);
  assert.match(sequenceDiagram, /Main -> Worker: boot\(\)/);
  assert.match(sequenceDiagram, /w -> w: inherited\(\)/);
  assert.match(sequenceDiagram, /w -> w: tick\(\)/);
});

test('comments, ordinary strings and raw strings cannot manufacture UML members or calls', () => {
  const { classDiagram, sequenceDiagram } = infer(`
    // class Fake { void fake(); };
    struct Real { void run() { const char* text = R"tag( } class Fake {}; ghost.run(); )tag"; } };
    int main() { Real real; const char* text = "ghost.run()"; real.run(); }
  `);
  assert.match(classDiagram, /class Real/);
  assert.doesNotMatch(classDiagram, /Fake|ghost/);
  assert.match(sequenceDiagram, /Main -> real: run\(\)/);
  assert.doesNotMatch(sequenceDiagram, /ghost|Fake/);
});

test('empty source, class-only source and malformed input have explicit outcomes', () => {
  assert.equal(infer('').classDiagram, '');
  assert.equal(infer('').sequenceDiagram, '');
  assert.equal(infer('struct Empty {};').sequenceDiagram, '');
  const result = analyzeCppSources({ 'broken.cpp': 'class Broken { public: void run() {' });
  assert.match(result.errors.join('\n'), /broken\.cpp.*[Uu]nclosed/);
});

test('recursive calls terminate with balanced activations and deterministic results', () => {
  const source = 'struct Worker { void run() { run(); } }; int main() { Worker w; w.run(); }';
  const first = infer(source).sequenceDiagram;
  assert.equal(first, infer(source).sequenceDiagram);
  assert.ok(first.length < 1500, 'recursive bodies must not expand without a bound');
  assert.equal((first.match(/^activate /gm) || []).length, (first.match(/^deactivate /gm) || []).length);
});

test('borrowed containers do not imply ownership of their elements', () => {
  const { classDiagram } = infer('struct Item {}; struct View { const std::vector<Item>& items; std::span<Item> range; };');
  assert.match(classDiagram, /View --> "\*" Item/);
  assert.doesNotMatch(classDiagram, /View .*\*--/);
});

test('multiple local declarations and auto value construction create distinct receivers', () => {
  const { sequenceDiagram } = infer('struct Worker { void run() {} }; int main() { Worker a, b; auto c = Worker{}; a.run(); b.run(); c.run(); }');
  for (const name of ['a', 'b', 'c']) {
    assert.match(sequenceDiagram, new RegExp('Main --> ' + name + ': <<create>>'));
    assert.match(sequenceDiagram, new RegExp('Main -> ' + name + ': run\\(\\)'));
  }
});

test('out-of-line parameter names are bound to the definition body', () => {
  const { sequenceDiagram, errors } = analyzeCppSources({
    'worker.hpp': 'struct Worker { void run() {} }; struct App { void start(Worker& declarationName); };',
    'main.cpp': 'void App::start(Worker& definitionName) { definitionName.run(); } int main() { Worker w; App app; app.start(w); }'
  });
  assert.deepEqual(errors, []);
  assert.match(sequenceDiagram, /app -> w: run\(\)/);
});

test('default arguments from a header survive an out-of-line method definition', () => {
  const { sequenceDiagram } = infer(`
    struct Worker { void run(int count = 1); void tick() {} };
    void Worker::run(int count) { tick(); }
    int main() { Worker w; w.run(); }
  `);
  assert.match(sequenceDiagram, /Main -> w: run\(\)/);
  assert.match(sequenceDiagram, /w -> w: tick\(\)/);
});

test('namespace-qualified free functions merge with declarations and resolve by arity', () => {
  const { sequenceDiagram } = infer(`
    struct Worker { void one() {} void two() {} };
    namespace app { void run(Worker& w); void run(Worker& w, int count); }
    void app::run(Worker& worker) { worker.one(); }
    void app::run(Worker& worker, int count) { worker.two(); }
    int main() { Worker w; app::run(w); app::run(w, 2); }
  `);
  assert.match(sequenceDiagram, /Main -> w: one\(\)[\s\S]*Main -> w: two\(\)/);
});

test('unresolved same-arity overloads keep the call without inventing a body or reply type', () => {
  const { sequenceDiagram } = infer(`
    struct Worker {
      int run(int value) { first(); return 1; }
      bool run(bool value) { second(); return true; }
      void first() {} void second() {}
    };
    int main() { Worker w; w.run(1); }
  `);
  assert.match(sequenceDiagram, /Main -> w: run\(1\)/);
  assert.doesNotMatch(sequenceDiagram, /first\(\)|second\(\)|w --> Main:/);
});

test('loop conditions, exception handlers and subsequent calls keep their control-flow context', () => {
  const { sequenceDiagram } = infer(`
    struct Worker { bool ready() { return true; } void run() {} void recover() {} void finish() {} };
    int main() { Worker w; while (w.ready()) w.run(); try { w.run(); } catch (...) { w.recover(); } w.finish(); }
  `);
  assert.match(sequenceDiagram, /loop \[while[\s\S]*Main -> w: ready\(\)[\s\S]*Main -> w: run\(\)[\s\S]*end/);
  assert.match(sequenceDiagram, /alt \[try\][\s\S]*Main -> w: run\(\)[\s\S]*else \[catch[\s\S]*Main -> w: recover\(\)[\s\S]*end\s+Main -> w: finish\(\)/);
});
