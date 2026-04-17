// @ts-check
/**
 * Regression tests for the Python UML class diagram inference engine.
 *
 * These tests run the analyzer in Node.js (no browser needed) against every
 * starter and solution code sample from the Python UML tutorial, and assert
 * that the generated PlantUML output matches the expected snapshot.
 *
 * To update snapshots after intentional changes, re-run the analyzer in the
 * browser and paste the new expected strings here.
 */

// Load the analyzer — it attaches analyzePythonSources to `global`.
require('../js/uml-analyzer-python.js');

const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Run the analyzer on a single Python source string and return the class diagram. */
function inferDiagram(code) {
  return global.analyzePythonSources({ 'test.py': code }).classDiagram;
}

// ---------------------------------------------------------------------------
// Step 1 — Your First Class Diagram
// ---------------------------------------------------------------------------

test.describe('Step 1: Your First Class Diagram', () => {
  test('starter — comments only, no classes', () => {
    const code = [
      '# Your task: create a Student class that matches the target diagram.',
      '#',
      '# The class needs:',
      '#   - An __init__ that accepts name and student_id',
      '#   - Both stored as instance attributes',
      '#   - A get_info() method returning "name (student_id)"',
    ].join('\n');

    expect(inferDiagram(code)).toBe('');
  });

  test('solution — Student class without type hints', () => {
    const code = [
      'class Student:',
      '    def __init__(self, name, student_id):',
      '        self.name = name',
      '        self.student_id = student_id',
      '',
      '    def get_info(self):',
      '        return f"{self.name} ({self.student_id})"',
    ].join('\n');

    const expected = [
      '@startuml',
      'layout landscape',
      'layout compact',
      'class Student {',
      '  +name',
      '  +student_id',
      '  +__init__(name, student_id)',
      '  +get_info()',
      '}',
      '@enduml',
    ].join('\n');

    expect(inferDiagram(code)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Step 2 — Visibility: Who Can See What?
// ---------------------------------------------------------------------------

test.describe('Step 2: Visibility', () => {
  test('starter — all public', () => {
    const code = [
      'class BankAccount:',
      '    def __init__(self, initial_balance: float) -> None:',
      '        self.balance: float = initial_balance',
      '',
      '    def deposit(self, amount: float) -> None:',
      '        if self.validate_amount(amount):',
      '            self.balance += amount',
      '',
      '    def withdraw(self, amount: float) -> bool:',
      '        if self.validate_amount(amount) and self.balance >= amount:',
      '            self.balance -= amount',
      '            return True',
      '        return False',
      '',
      '    def get_balance(self) -> float:',
      '        return self.balance',
      '',
      '    def validate_amount(self, amount: float) -> bool:',
      '        return amount > 0',
    ].join('\n');

    const expected = [
      '@startuml',
      'layout landscape',
      'layout compact',
      'class BankAccount {',
      '  +balance: float',
      '  +__init__(initial_balance: float): None',
      '  +deposit(amount: float): None',
      '  +withdraw(amount: float): bool',
      '  +get_balance(): float',
      '  +validate_amount(amount: float): bool',
      '}',
      '@enduml',
    ].join('\n');

    expect(inferDiagram(code)).toBe(expected);
  });

  test('solution — private and protected visibility', () => {
    const code = [
      'class BankAccount:',
      '    def __init__(self, initial_balance: float) -> None:',
      '        self.__balance: float = initial_balance',
      '',
      '    def deposit(self, amount: float) -> None:',
      '        if self._validate_amount(amount):',
      '            self.__balance += amount',
      '',
      '    def withdraw(self, amount: float) -> bool:',
      '        if self._validate_amount(amount) and self.__balance >= amount:',
      '            self.__balance -= amount',
      '            return True',
      '        return False',
      '',
      '    def get_balance(self) -> float:',
      '        return self.__balance',
      '',
      '    def _validate_amount(self, amount: float) -> bool:',
      '        return amount > 0',
    ].join('\n');

    const expected = [
      '@startuml',
      'layout landscape',
      'layout compact',
      'class BankAccount {',
      '  -__balance: float',
      '  +__init__(initial_balance: float): None',
      '  +deposit(amount: float): None',
      '  +withdraw(amount: float): bool',
      '  +get_balance(): float',
      '  #_validate_amount(amount: float): bool',
      '}',
      '@enduml',
    ].join('\n');

    expect(inferDiagram(code)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Step 3 — Types Matter: Explicit Contracts
// ---------------------------------------------------------------------------

test.describe('Step 3: Type Hints', () => {
  test('starter — no type hints', () => {
    const code = [
      'class Product:',
      '    def __init__(self, name, price, in_stock):',
      '        self.__name = name',
      '        self.__price = price',
      '        self.__in_stock = in_stock',
      '',
      '    def get_name(self):',
      '        return self.__name',
      '',
      '    def get_price(self):',
      '        return self.__price',
      '',
      '    def is_available(self):',
      '        return self.__in_stock',
      '',
      '    def apply_discount(self, percent):',
      '        discount = self.__price * (percent / 100)',
      '        return self.__price - discount',
    ].join('\n');

    const expected = [
      '@startuml',
      'layout landscape',
      'layout compact',
      'class Product {',
      '  -__name',
      '  -__price',
      '  -__in_stock',
      '  +__init__(name, price, in_stock)',
      '  +get_name()',
      '  +get_price()',
      '  +is_available()',
      '  +apply_discount(percent)',
      '}',
      '@enduml',
    ].join('\n');

    expect(inferDiagram(code)).toBe(expected);
  });

  test('solution — full type hints', () => {
    const code = [
      'class Product:',
      '    def __init__(self, name: str, price: float, in_stock: bool) -> None:',
      '        self.__name: str = name',
      '        self.__price: float = price',
      '        self.__in_stock: bool = in_stock',
      '',
      '    def get_name(self) -> str:',
      '        return self.__name',
      '',
      '    def get_price(self) -> float:',
      '        return self.__price',
      '',
      '    def is_available(self) -> bool:',
      '        return self.__in_stock',
      '',
      '    def apply_discount(self, percent: float) -> float:',
      '        discount = self.__price * (percent / 100)',
      '        return self.__price - discount',
    ].join('\n');

    const expected = [
      '@startuml',
      'layout landscape',
      'layout compact',
      'class Product {',
      '  -__name: str',
      '  -__price: float',
      '  -__in_stock: bool',
      '  +__init__(name: str, price: float, in_stock: bool): None',
      '  +get_name(): str',
      '  +get_price(): float',
      '  +is_available(): bool',
      '  +apply_discount(percent: float): float',
      '}',
      '@enduml',
    ].join('\n');

    expect(inferDiagram(code)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Step 4 — Inheritance: Is-A Relationships
// ---------------------------------------------------------------------------

test.describe('Step 4: Inheritance', () => {
  test('starter — no inheritance, duplicated code', () => {
    const code = [
      'import math',
      '',
      'class Shape:',
      '    def __init__(self, color: str) -> None:',
      '        self.color: str = color',
      '    def area(self) -> float:',
      '        return 0.0',
      '    def describe(self) -> str:',
      '        return f"{self.color} shape"',
      '',
      'class Circle:',
      '    def __init__(self, color: str, radius: float) -> None:',
      '        self.color: str = color',
      '        self.radius: float = radius',
      '    def area(self) -> float:',
      '        return math.pi * self.radius ** 2',
      '    def describe(self) -> str:',
      '        return f"{self.color} shape"',
      '',
      'class Rectangle:',
      '    def __init__(self, color: str, width: float, height: float) -> None:',
      '        self.color: str = color',
      '        self.width: float = width',
      '        self.height: float = height',
      '    def area(self) -> float:',
      '        return self.width * self.height',
      '    def describe(self) -> str:',
      '        return f"{self.color} shape"',
    ].join('\n');

    const diagram = inferDiagram(code);
    // Three independent classes, no inheritance arrows
    expect(diagram).toContain('class Shape {');
    expect(diagram).toContain('class Circle {');
    expect(diagram).toContain('class Rectangle {');
    expect(diagram).not.toContain('--|>');
  });

  test('solution — proper inheritance hierarchy', () => {
    const code = [
      'import math',
      '',
      'class Shape:',
      '    def __init__(self, color: str) -> None:',
      '        self.color: str = color',
      '    def area(self) -> float:',
      '        return 0.0',
      '    def describe(self) -> str:',
      '        return f"{self.color} shape"',
      '',
      'class Circle(Shape):',
      '    def __init__(self, color: str, radius: float) -> None:',
      '        super().__init__(color)',
      '        self.radius: float = radius',
      '    def area(self) -> float:',
      '        return math.pi * self.radius ** 2',
      '',
      'class Rectangle(Shape):',
      '    def __init__(self, color: str, width: float, height: float) -> None:',
      '        super().__init__(color)',
      '        self.width: float = width',
      '        self.height: float = height',
      '    def area(self) -> float:',
      '        return self.width * self.height',
    ].join('\n');

    const diagram = inferDiagram(code);
    expect(diagram).toContain('Circle --|> Shape');
    expect(diagram).toContain('Rectangle --|> Shape');
    // Subclasses should NOT have color as a standalone attribute line
    expect(diagram).not.toMatch(/\+color: str\n.*\+radius/);
  });
});

// ---------------------------------------------------------------------------
// Step 5 — Association: Classes That Know Each Other
// ---------------------------------------------------------------------------

test.describe('Step 5: Association', () => {
  test('starter — no association, instructor is a string', () => {
    const code = [
      'class Course:',
      '    def __init__(self, name: str, instructor_name: str) -> None:',
      '        self.name: str = name',
      '        self.instructor_name: str = instructor_name',
      '    def get_instructor_name(self) -> str:',
      '        return self.instructor_name',
    ].join('\n');

    const diagram = inferDiagram(code);
    expect(diagram).toContain('class Course {');
    expect(diagram).not.toContain('-->');
  });

  test('solution — navigable association to Instructor', () => {
    const code = [
      'class Instructor:',
      '    def __init__(self, name: str, department: str) -> None:',
      '        self.name: str = name',
      '        self.department: str = department',
      '    def get_title(self) -> str:',
      '        return f"{self.name} ({self.department})"',
      '',
      'class Course:',
      '    def __init__(self, name: str, instructor: Instructor) -> None:',
      '        self.name: str = name',
      '        self.instructor: Instructor = instructor',
      '    def get_instructor_name(self) -> str:',
      '        return self.instructor.name',
    ].join('\n');

    const diagram = inferDiagram(code);
    expect(diagram).toContain('Course --> "1" Instructor');
    // instructor attribute should be hidden (promoted to relationship arrow)
    expect(diagram).not.toContain('+instructor: Instructor');
  });
});

// ---------------------------------------------------------------------------
// Step 6 — Composition vs Aggregation
// ---------------------------------------------------------------------------

test.describe('Step 6: Composition vs Aggregation', () => {
  test('starter — empty method stubs, only dependencies', () => {
    const code = [
      'class Professor:',
      '    def __init__(self, name: str, field: str) -> None:',
      '        self.name: str = name',
      '        self.field: str = field',
      '',
      'class Department:',
      '    def __init__(self, name: str) -> None:',
      '        self.name: str = name',
      '        self.professors: list[Professor] = []',
      '    def add_professor(self, prof: Professor) -> None:',
      '        pass',
      '',
      'class University:',
      '    def __init__(self, name: str) -> None:',
      '        self.name: str = name',
      '        self.departments: list[Department] = []',
      '    def add_department(self, dept_name: str) -> None:',
      '        pass',
      '    def get_department(self, name: str) -> Department:',
      '        for dept in self.departments:',
      '            if dept.name == name:',
      '                return dept',
      '        raise ValueError("not found")',
    ].join('\n');

    const diagram = inferDiagram(code);
    // No composition/aggregation since stubs are empty
    expect(diagram).not.toContain('*-->');
    expect(diagram).not.toContain('o-->');
    // Collection attributes should be visible
    expect(diagram).toContain('+professors: list[Professor]');
    expect(diagram).toContain('+departments: list[Department]');
  });

  test('solution — composition and aggregation with navigability', () => {
    const code = [
      'class Professor:',
      '    def __init__(self, name: str, field: str) -> None:',
      '        self.name: str = name',
      '        self.field: str = field',
      '',
      'class Department:',
      '    def __init__(self, name: str) -> None:',
      '        self.name: str = name',
      '        self.professors: list[Professor] = []',
      '    def add_professor(self, prof: Professor) -> None:',
      '        self.professors.append(prof)',
      '',
      'class University:',
      '    def __init__(self, name: str) -> None:',
      '        self.name: str = name',
      '        self.departments: list[Department] = []',
      '    def add_department(self, dept_name: str) -> None:',
      '        dept = Department(dept_name)',
      '        self.departments.append(dept)',
      '    def get_department(self, name: str) -> Department:',
      '        for dept in self.departments:',
      '            if dept.name == name:',
      '                return dept',
      '        raise ValueError("not found")',
    ].join('\n');

    const diagram = inferDiagram(code);
    // Aggregation: professors are passed in from outside
    expect(diagram).toContain('Department o--> "*" Professor');
    // Composition: departments are created inside University
    expect(diagram).toContain('University *--> "*" Department');
    // Collection attributes should be visible
    expect(diagram).toContain('+professors: list[Professor]');
    expect(diagram).toContain('+departments: list[Department]');
  });
});

// ---------------------------------------------------------------------------
// Step 7 — Multiplicity: How Many?
// ---------------------------------------------------------------------------

test.describe('Step 7: Multiplicity', () => {
  test('starter — single Song association', () => {
    const code = [
      'class Song:',
      '    def __init__(self, title: str, artist: str, duration_sec: int) -> None:',
      '        self.title: str = title',
      '        self.artist: str = artist',
      '        self.duration_sec: int = duration_sec',
      '',
      'class Playlist:',
      '    def __init__(self, name: str, song: Song) -> None:',
      '        self.name: str = name',
      '        self.song: Song = song',
    ].join('\n');

    const diagram = inferDiagram(code);
    expect(diagram).toContain('Playlist --> "1" Song');
  });

  test('solution — aggregation with * multiplicity', () => {
    const code = [
      'class Song:',
      '    def __init__(self, title: str, artist: str, duration_sec: int) -> None:',
      '        self.title: str = title',
      '        self.artist: str = artist',
      '        self.duration_sec: int = duration_sec',
      '',
      'class Playlist:',
      '    def __init__(self, name: str) -> None:',
      '        self.name: str = name',
      '        self.songs: list[Song] = []',
      '    def add_song(self, song: Song) -> None:',
      '        self.songs.append(song)',
      '    def get_total_duration(self) -> int:',
      '        return sum(s.duration_sec for s in self.songs)',
      '    def get_song_count(self) -> int:',
      '        return len(self.songs)',
    ].join('\n');

    const diagram = inferDiagram(code);
    expect(diagram).toContain('Playlist o--> "*" Song');
    expect(diagram).toContain('+songs: list[Song]');
  });
});

// ---------------------------------------------------------------------------
// Step 8 — Abstract Classes: Designing for Extension
// ---------------------------------------------------------------------------

test.describe('Step 8: Abstract Classes', () => {
  test('starter — concrete base class, no ABC', () => {
    const code = [
      'class PaymentMethod:',
      '    def process(self, amount: float) -> bool:',
      '        return False',
      '    def get_name(self) -> str:',
      '        return "Unknown"',
      '',
      'class CreditCard(PaymentMethod):',
      '    def __init__(self, card_number: str) -> None:',
      '        self.card_number: str = card_number',
      '',
      'class BankTransfer(PaymentMethod):',
      '    def __init__(self, account_number: str) -> None:',
      '        self.account_number: str = account_number',
    ].join('\n');

    const diagram = inferDiagram(code);
    // Should be a regular class, not abstract
    expect(diagram).toContain('class PaymentMethod {');
    expect(diagram).not.toContain('abstract class');
    expect(diagram).toContain('CreditCard --|> PaymentMethod');
    expect(diagram).toContain('BankTransfer --|> PaymentMethod');
  });

  test('solution — abstract base class with ABC', () => {
    const code = [
      'from abc import ABC, abstractmethod',
      '',
      'class PaymentMethod(ABC):',
      '    @abstractmethod',
      '    def process(self, amount: float) -> bool:',
      '        pass',
      '    @abstractmethod',
      '    def get_name(self) -> str:',
      '        pass',
      '',
      'class CreditCard(PaymentMethod):',
      '    def __init__(self, card_number: str) -> None:',
      '        self.card_number: str = card_number',
      '    def process(self, amount: float) -> bool:',
      '        return True',
      '    def get_name(self) -> str:',
      '        return "Credit Card"',
      '',
      'class BankTransfer(PaymentMethod):',
      '    def __init__(self, account_number: str) -> None:',
      '        self.account_number: str = account_number',
      '    def process(self, amount: float) -> bool:',
      '        return True',
      '    def get_name(self) -> str:',
      '        return "Bank Transfer"',
    ].join('\n');

    const diagram = inferDiagram(code);
    expect(diagram).toContain('abstract class PaymentMethod {');
    expect(diagram).toContain('{abstract} +process(amount: float): bool');
    expect(diagram).toContain('{abstract} +get_name(): str');
    expect(diagram).toContain('CreditCard --|> PaymentMethod');
    expect(diagram).toContain('BankTransfer --|> PaymentMethod');
  });
});

// ---------------------------------------------------------------------------
// Step 9 — The Fixer-Upper: Diagnose a Bad Design
// ---------------------------------------------------------------------------

test.describe('Step 9: God Class Refactoring', () => {
  test('starter — God Class with no relationships', () => {
    const code = [
      'class OnlineStore:',
      '    def __init__(self) -> None:',
      '        self._product_names: list[str] = []',
      '        self._product_prices: list[float] = []',
      '        self._product_stocks: list[int] = []',
      '        self._order_customer_names: list[str] = []',
      '        self._order_customer_emails: list[str] = []',
      '        self._order_items: list[Product] = []',
      '        self._order_totals: list[float] = []',
      '    def add_product(self, name: str, price: float, stock: int) -> None:',
      '        self._product_names.append(name)',
      '        self._product_prices.append(price)',
      '        self._product_stocks.append(stock)',
      '    def is_product_available(self, name: str) -> bool:',
      '        idx = self._product_names.index(name)',
      '        return self._product_stocks[idx] > 0',
      '    def get_product_price(self, name: str) -> float:',
      '        idx = self._product_names.index(name)',
      '        return self._product_prices[idx]',
      '    def reduce_product_stock(self, name: str) -> None:',
      '        idx = self._product_names.index(name)',
      '        self._product_stocks[idx] -= 1',
      '    def place_order(self, customer_name: str, customer_email: str, product_names: list) -> int:',
      '        total = 0.0',
      '        for pname in product_names:',
      '            total += self.get_product_price(pname)',
      '            self.reduce_product_stock(pname)',
      '        self._order_customer_names.append(customer_name)',
      '        self._order_customer_emails.append(customer_email)',
      '        self._order_items.append(product_names)',
      '        self._order_totals.append(total)',
      '        order_id = len(self._order_totals) - 1',
      '        return order_id',
      '    def get_order_total(self, order_id: int) -> float:',
      '        return self._order_totals[order_id]',
    ].join('\n');

    const diagram = inferDiagram(code);
    // Single monolithic class, no relationship arrows
    expect(diagram).toContain('class OnlineStore {');
    expect(diagram).not.toContain('-->');
    expect(diagram).not.toContain('*-->');
    expect(diagram).not.toContain('o-->');
    expect(diagram).not.toContain('--|>');
  });

  test('solution — proper decomposition with all relationship types', () => {
    const code = [
      'class Product:',
      '    def __init__(self, name: str, price: float, stock: int) -> None:',
      '        self.name: str = name',
      '        self.price: float = price',
      '        self.stock: int = stock',
      '    def is_available(self) -> bool:',
      '        return self.stock > 0',
      '    def reduce_stock(self) -> None:',
      '        self.stock -= 1',
      '',
      'class Customer:',
      '    def __init__(self, name: str, email: str) -> None:',
      '        self.name: str = name',
      '        self.email: str = email',
      '',
      'class Order:',
      '    def __init__(self, customer: Customer) -> None:',
      '        self.customer: Customer = customer',
      '        self.items: list[Product] = []',
      '        self.total: float = 0.0',
      '    def add_item(self, product: Product) -> None:',
      '        self.items.append(product)',
      '        self.total += product.price',
      '        product.reduce_stock()',
      '',
      'class OnlineStore:',
      '    def __init__(self) -> None:',
      '        self.products: list[Product] = []',
      '        self.orders: list[Order] = []',
      '    def add_product(self, product: Product) -> None:',
      '        self.products.append(product)',
      '    def place_order(self, customer: Customer, product_names: list) -> Order:',
      '        order = Order(customer)',
      '        for name in product_names:',
      '            for p in self.products:',
      '                if p.name == name and p.is_available():',
      '                    order.add_item(p)',
      '                    break',
      '        self.orders.append(order)',
      '        return order',
    ].join('\n');

    const diagram = inferDiagram(code);
    // Order aggregates Products (passed in from outside)
    expect(diagram).toContain('Order o--> "*" Product');
    // Order has a navigable association to Customer
    expect(diagram).toContain('Order --> "1" Customer');
    // OnlineStore composes Orders (created inside via Order(customer))
    expect(diagram).toContain('OnlineStore *--> "*" Order');
    // OnlineStore aggregates Products (passed in via add_product)
    expect(diagram).toContain('OnlineStore o--> "*" Product');
    // Customer appears as dependency (parameter to place_order, not stored)
    expect(diagram).toContain('OnlineStore ..> Customer');
    // Collection attributes should be visible
    expect(diagram).toContain('+items: list[Product]');
    expect(diagram).toContain('+products: list[Product]');
    expect(diagram).toContain('+orders: list[Order]');
  });
});

// ---------------------------------------------------------------------------
// Audit fix tests
// ---------------------------------------------------------------------------

test.describe('Return types shown including None', () => {
  test('__init__ -> None is shown', () => {
    const code = [
      'class Foo:',
      '    def __init__(self, x: int) -> None:',
      '        self.x: int = x',
    ].join('\n');
    const diagram = inferDiagram(code);
    expect(diagram).toContain('+__init__(x: int): None');
  });

  test('void and non-void return types both shown', () => {
    const code = [
      'class Foo:',
      '    def do_thing(self) -> None:',
      '        pass',
      '    def get_value(self) -> int:',
      '        return 42',
    ].join('\n');
    const diagram = inferDiagram(code);
    expect(diagram).toContain('+do_thing(): None');
    expect(diagram).toContain('+get_value(): int');
  });
});

test.describe('Fix 6: Flag/IntFlag enum detection', () => {
  test('Flag and IntFlag are rendered as enum', () => {
    const code = [
      'class Permission(Flag):',
      '    READ = 1',
      '    WRITE = 2',
      '',
      'class Color(IntFlag):',
      '    RED = 1',
      '    GREEN = 2',
    ].join('\n');
    const diagram = inferDiagram(code);
    expect(diagram).toContain('enum Permission {');
    expect(diagram).toContain('enum Color {');
  });
});

test.describe('Fix 3: Property setter/deleter filtering', () => {
  test('@name.setter method is not shown as a regular method', () => {
    const code = [
      'class Temperature:',
      '    def __init__(self, celsius: float) -> None:',
      '        self._celsius: float = celsius',
      '',
      '    @property',
      '    def fahrenheit(self) -> float:',
      '        return self._celsius * 9/5 + 32',
      '',
      '    @fahrenheit.setter',
      '    def fahrenheit(self, value: float) -> None:',
      '        self._celsius = (value - 32) * 5/9',
    ].join('\n');
    const diagram = inferDiagram(code);
    // Property getter should appear as attribute
    expect(diagram).toContain('+fahrenheit: float');
    // Setter should NOT appear as method
    expect(diagram).not.toContain('+fahrenheit(value: float)');
  });
});

test.describe('Fix 4: Class-level annotation multiplicity', () => {
  test('class-level List[Task] annotation gets * multiplicity', () => {
    const code = [
      'class Task:',
      '    pass',
      '',
      'class Board:',
      '    tasks: list[Task]',
    ].join('\n');
    const diagram = inferDiagram(code);
    expect(diagram).toContain('Board --> "*" Task');
  });

  test('class-level single-type annotation gets "1" multiplicity', () => {
    const code = [
      'class Engine:',
      '    pass',
      '',
      'class Car:',
      '    engine: Engine',
    ].join('\n');
    const diagram = inferDiagram(code);
    expect(diagram).toContain('Car --> "1" Engine');
  });
});

test.describe('Fix 2: Inline constructor in append', () => {
  test('self.items.append(Task()) produces composition', () => {
    const code = [
      'class Task:',
      '    def __init__(self, name: str) -> None:',
      '        self.name: str = name',
      '',
      'class TaskList:',
      '    def __init__(self) -> None:',
      '        self.tasks: list[Task] = []',
      '    def create_task(self, name: str) -> None:',
      '        self.tasks.append(Task(name))',
    ].join('\n');
    const diagram = inferDiagram(code);
    expect(diagram).toContain('TaskList *--> "*" Task');
    expect(diagram).not.toContain('o-->');
    expect(diagram).not.toContain('..>');
  });
});

test.describe('Fix 1: Annotation fallback for unresolved collections', () => {
  test('list[Task] = [] with extend() falls back to association', () => {
    const code = [
      'class Task:',
      '    pass',
      '',
      'class Queue:',
      '    def __init__(self) -> None:',
      '        self.tasks: list[Task] = []',
      '    def add_batch(self, tasks: list) -> None:',
      '        self.tasks.extend(tasks)',
    ].join('\n');
    const diagram = inferDiagram(code);
    // Falls back to association from annotation since extend is not tracked
    expect(diagram).toContain('Queue --> "*" Task');
  });

  test('list[Task] = [] with no mutation falls back to association', () => {
    const code = [
      'class Task:',
      '    pass',
      '',
      'class ReadOnlyQueue:',
      '    def __init__(self) -> None:',
      '        self.tasks: list[Task] = []',
    ].join('\n');
    const diagram = inferDiagram(code);
    expect(diagram).toContain('ReadOnlyQueue --> "*" Task');
  });

  test('list[Task] = [] with append(param) resolves to aggregation, no fallback', () => {
    const code = [
      'class Task:',
      '    pass',
      '',
      'class Queue:',
      '    def __init__(self) -> None:',
      '        self.tasks: list[Task] = []',
      '    def add(self, task: Task) -> None:',
      '        self.tasks.append(task)',
    ].join('\n');
    const diagram = inferDiagram(code);
    expect(diagram).toContain('Queue o--> "*" Task');
    // Should NOT also have association fallback
    expect(diagram).not.toContain('Queue -->');
  });
});
