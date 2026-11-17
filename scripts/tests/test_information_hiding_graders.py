"""Behavioral regressions for the Information Hiding tutorial's authored checks.

Every lesson's `tests[].command` runs against the starter, the model solution,
independently written correct submissions, and plausible mistakes. A lesson's
checks must reward any correct design and reject each mistake for its own
reason, so a learner who fixes one thing sees exactly that check turn green.

All checks of one submission run in one interpreter, in order, the way the
browser's Python worker runs them.
"""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import yaml


ROOT = Path(__file__).resolve().parents[2]
TUTORIAL_PATH = Path(os.environ.get(
    "IH_TUTORIAL_YAML", ROOT / "_data/tutorials/information-hiding.yml"))
GRADING_HELPER = Path(os.environ.get(
    "IH_GRADING_HELPER", ROOT / "assets/tutorials/python_test_grading.py"))
TUTORIAL = yaml.safe_load(TUTORIAL_PATH.read_text())
STEPS = {step["key"]: step for step in TUTORIAL["steps"]}

RUNNER = r'''
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("tutorial_test_grading", sys.argv[1])
grading = importlib.util.module_from_spec(spec)
spec.loader.exec_module(grading)
sys.modules["tutorial_test_grading"] = grading
sys.path.insert(0, sys.argv[2])
sys.dont_write_bytecode = True
outcomes = []
for command in json.load(open(sys.argv[3])):
    try:
        exec(compile(command, "<check>", "exec"), {})
    except AssertionError as error:
        outcomes.append(["F", str(error)[:400]])
    except BaseException as error:  # a check must fail by assertion, never crash
        outcomes.append(["E", type(error).__name__ + ": " + str(error)[:400]])
    else:
        outcomes.append(["P", ""])
print(json.dumps(outcomes))
'''


def starter(key):
    return {file["path"]: file["content"] for file in STEPS[key]["files"]}


def solution(key):
    files = starter(key)
    files.update({file["path"]: file["content"] for file in STEPS[key]["solution"]["files"]})
    return files


def patch(files, name, old, new, count=1):
    """Return a copy with one exact edit; fail loudly if the lesson's code moved."""
    assert old in files[name], f"{name} no longer contains {old!r}"
    changed = dict(files)
    changed[name] = files[name].replace(old, new, count)
    return changed


def with_file(files, name, content):
    changed = dict(files)
    changed[name] = content
    return changed


def outcomes(key, files):
    """Run the lesson's checks on one submission; return e.g. 'PPFP' and details."""
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(os.path.realpath(temporary))
        workspace = root / "tutorial"
        workspace.mkdir()
        for name, content in files.items():
            (workspace / name).write_text(content)
        commands = [check["command"].replace("/tutorial/", str(workspace) + "/")
                    for check in STEPS[key]["tests"]]
        (root / "commands.json").write_text(json.dumps(commands))
        (root / "runner.py").write_text(RUNNER)
        completed = subprocess.run(
            [sys.executable, str(root / "runner.py"), str(GRADING_HELPER),
             str(workspace), str(root / "commands.json")],
            capture_output=True, text=True, cwd=workspace, timeout=300)
        assert completed.returncode == 0, completed.stderr
        results = json.loads(completed.stdout.strip().splitlines()[-1])
    return "".join(status for status, _ in results), results


class GraderCase(unittest.TestCase):
    key = None

    def assert_outcomes(self, name, files, expected):
        with self.subTest(submission=name):
            actual, results = outcomes(self.key, files)
            descriptions = [check["description"] for check in STEPS[self.key]["tests"]]
            detail = "\n".join(
                f"  [{index}] {status} {descriptions[index]} :: {message}"
                for index, (status, message) in enumerate(results) if status != "P")
            self.assertNotIn("E", actual, f"{name}: a check crashed instead of failing\n{detail}")
            self.assertEqual(actual, expected, f"{name}\n{detail}")


def set_impact(files, before, after):
    text = files["change_impact.py"]
    start = text.index("BEFORE = ")
    head = text[:start]
    return with_file(files, "change_impact.py",
                     head + f"BEFORE = {before!r}\n\nAFTER = {after!r}\n")


# --------------------------------------------------------------------------- 1
PAYMENT_FILES = ["payments.py", "order_service.py", "refund_service.py", "wallet_service.py"]

HAND_WRITTEN_PAYMENTS = '''from paypal_sdk import PayPalClient


class Payments:
    """Boba Run's payments module. The only code that knows we use PayPal."""

    def __init__(self) -> None:
        self._client = PayPalClient("boba-run")

    def _token(self) -> str:
        return self._client.authenticate()

    def charge(self, cents: int) -> bool:
        return self._client.capture(self._token(), cents).was_successful()

    def refund(self, cents: int) -> bool:
        return self._client.reverse(self._token(), cents).was_successful()

    def save_card(self, customer: str) -> str:
        return self._client.vault(self._token(), customer)
'''

HAND_WRITTEN_ORDER_SERVICE = '''from order import Order
from payments import Payments


class OrderService:
    def checkout(self, payments: Payments, order: Order) -> bool:
        if not payments.charge(order.total_cents):
            return False
        order.status = "paid"
        return True
'''

HAND_WRITTEN_REFUND_SERVICE = '''from order import Order
from payments import Payments


class RefundService:
    def refund_order(self, payments: Payments, order: Order) -> bool:
        refunded = payments.refund(order.total_cents)
        if refunded:
            order.status = "refunded"
        return refunded
'''

HAND_WRITTEN_WALLET_SERVICE = '''from payments import Payments


class WalletService:
    def __init__(self) -> None:
        self.saved_cards: dict[str, str] = {}

    def add_payment_method(self, payments: Payments, customer: str) -> str:
        self.saved_cards[customer] = payments.save_card(customer)
        return self.saved_cards[customer]
'''


class PaymentsLesson(GraderCase):
    key = "payments"

    def test_starter_and_model_solution(self):
        self.assert_outcomes("starter", starter(self.key), "FFFFFPFF")
        self.assert_outcomes("model solution", solution(self.key), "PPPPPPPP")

    def test_other_correct_submissions(self):
        by_hand = starter(self.key)
        by_hand.update({
            "payments.py": HAND_WRITTEN_PAYMENTS,
            "order_service.py": HAND_WRITTEN_ORDER_SERVICE,
            "refund_service.py": HAND_WRITTEN_REFUND_SERVICE,
            "wallet_service.py": HAND_WRITTEN_WALLET_SERVICE,
        })
        by_hand = set_impact(by_hand, list(reversed(PAYMENT_FILES)), ["payments.py"])
        self.assert_outcomes("refactored by hand, different shape", by_hand, "PPPPPPPP")

        # Move Method leaves a forwarding method in the source class. Keeping it is fine.
        kept = patch(solution(self.key), "order_service.py", "        return paid\n",
                     "        return paid\n\n    def charge(self, payments: Payments, cents):\n"
                     "        return payments.charge(cents)\n")
        self.assert_outcomes("forwarding method left behind", kept, "PPPPPPPP")

    def test_mistakes(self):
        # Extracting only the first two PayPal lines hands PayPal's result object back.
        partial = patch(solution(self.key), "order_service.py",
                        "        paid = payments.charge(cents)\n",
                        "        result = payments.charge(cents)\n        paid = result.was_successful()\n")
        partial = patch(partial, "payments.py",
                        "        paid = result.was_successful()\n        return paid\n",
                        "        return result\n")
        self.assert_outcomes("moved too few lines", partial, "PPFPPPPP")

        renamed = starter(self.key)
        renamed = patch(renamed, "payments.py", "self.paypal", "self._paypal")
        for name in ("order_service.py", "refund_service.py", "wallet_service.py"):
            renamed = patch(renamed, name, "payments.paypal", "payments._paypal", count=2)
        renamed = set_impact(renamed, PAYMENT_FILES, ["payments.py"])
        self.assert_outcomes("only renamed the attribute", renamed, "PPFFFPPP")

        # Making the client private before the services stop using it breaks the shop.
        too_early = patch(set_impact(starter(self.key), PAYMENT_FILES, []),
                          "payments.py", "self.paypal", "self.__paypal")
        self.assert_outcomes("renamed before moving", too_early, "PPFFFFPF")

        self.assert_outcomes(
            "analysis lists the test file",
            set_impact(solution(self.key), PAYMENT_FILES + ["test_shop.py"], ["payments.py"]),
            "PFPPPPPP")
        self.assert_outcomes(
            "analysis forgets payments.py",
            set_impact(solution(self.key), PAYMENT_FILES[1:], ["payments.py"]),
            "FPPPPPPP")


# --------------------------------------------------------------------------- 2
MENU_FILES = ["menu.py", "kiosk.py", "test_kiosk.py"]

HAND_WRITTEN_MENU = '''SUPPLIER_EXPORT = """\\
Taro Milk Tea,550,M|L
Thai Tea,500,M
Matcha Latte,625,M|L
"""


class Menu:
    """The drinks Boba Run sells. Only this class knows the supplier's layout."""

    def __init__(self, csv_text: str) -> None:
        self._prices: dict[str, int] = {}
        self._sizes: dict[str, list[str]] = {}
        for line in csv_text.splitlines():
            if line:
                name, cents, sizes = line.split(",")
                self._prices[name] = int(cents)
                self._sizes[name] = sizes.split("|")

    def drink_names(self) -> list[str]:
        return list(self._prices)

    def price_cents(self, drink: str) -> int:
        return self._prices.get(drink, 0)

    def sizes(self, drink: str) -> list[str]:
        return list(self._sizes.get(drink, []))


def load_menu() -> Menu:
    return Menu(SUPPLIER_EXPORT)
'''

HAND_WRITTEN_KIOSK = '''from menu import Menu


class Kiosk:
    def total_cents(self, menu: Menu, drinks: list[str]) -> int:
        return sum(menu.price_cents(drink) for drink in drinks)

    def offers_size(self, menu: Menu, drink: str, size: str) -> bool:
        return size in menu.sizes(drink)
'''

ROWS_TEST = '''def test_menu_keeps_the_supplier_rows():
    assert load_menu().rows()[0] == "Taro Milk Tea,550,M|L"
'''


class MenuLesson(GraderCase):
    key = "menu"

    def rewritten_test(self):
        """The third test of the model solution: whatever replaced ROWS_TEST."""
        text = solution(self.key)["test_kiosk.py"]
        return text[text.index("def test_", text.index("def test_large")+1):]

    def test_starter_and_model_solution(self):
        self.assertIn(ROWS_TEST, starter(self.key)["test_kiosk.py"])
        self.assert_outcomes("starter", starter(self.key), "FFFFPFPFFF")
        self.assert_outcomes("model solution", solution(self.key), "PPPPPPPPPP")

    def test_other_correct_submissions(self):
        by_hand = starter(self.key)
        by_hand.update({"menu.py": HAND_WRITTEN_MENU, "kiosk.py": HAND_WRITTEN_KIOSK})
        by_hand = patch(by_hand, "test_kiosk.py", ROWS_TEST,
                        "def test_menu_lists_its_drinks_in_order():\n"
                        "    assert load_menu().drink_names()[0] == \"Taro Milk Tea\"\n")
        by_hand = set_impact(by_hand, MENU_FILES, ["menu.py"])
        self.assert_outcomes("parsed once in __init__, by hand", by_hand, "PPPPPPPPPP")

    def test_mistakes(self):
        public_rows = patch(solution(self.key), "menu.py", "__rows", "rows", count=3)
        public_rows = patch(public_rows, "test_kiosk.py", self.rewritten_test(), ROWS_TEST)
        self.assert_outcomes("rows() still public and still tested", public_rows, "PPPPPFPFFP")

        fewer = patch(solution(self.key), "test_kiosk.py", self.rewritten_test(), "")
        self.assert_outcomes("deleted the failing test instead of rewriting it", fewer, "PPPPPPFFPP")


# --------------------------------------------------------------------------- 3
WAIT_FILES = ["wait_times.py", "pickup_screen.py", "text_message.py", "test_pickup.py"]

MOCK_TESTS = '''from unittest.mock import Mock

from pickup_screen import PickupScreen
from text_message import TextMessage


def estimate(minutes):
    wait_times = Mock()
    wait_times.minutes_until_ready.return_value = minutes
    return wait_times


def test_screen():
    assert PickupScreen().message(estimate(12), "B7") == "Order B7: ready in about 12 min"


def test_text_boundary():
    assert TextMessage().body(estimate(3), "B7") == "Your boba is next!"
    assert TextMessage().body(estimate(4), "B7") == "About 4 min until your boba is ready."
'''

SECOND_COPY = '''
    def minutes_until_ready(self, order_id: str):
        ahead = self.queue.position(order_id)
        minutes = (ahead + 1) * self.minutes_per_drink
        return minutes
'''


class WaitTimesLesson(GraderCase):
    key = "wait-times"

    def test_starter_and_model_solution(self):
        self.assert_outcomes("starter", starter(self.key), "FFFFFPFFFFF")
        self.assert_outcomes("model solution", solution(self.key), "PPPPPPPPPPP")

    def test_other_correct_submissions(self):
        self.assert_outcomes("stubs built with unittest.mock",
                             with_file(solution(self.key), "test_pickup.py", MOCK_TESTS),
                             "PPPPPPPPPPP")
        # Running Extract + Move on the second client adds an identical second method.
        twice = solution(self.key)
        twice = with_file(twice, "wait_times.py", twice["wait_times.py"].rstrip("\n") + "\n" + SECOND_COPY)
        self.assert_outcomes("moved the same lines twice", twice, "PPPPPPPPPPP")

    def test_mistakes(self):
        tests = solution(self.key)["test_pickup.py"]
        self.assertIn("(4)", tests, "the model solution should test just above the boundary")
        one_sided = with_file(solution(self.key), "test_pickup.py",
                              tests.replace("(4)", "(9)").replace("About 4 min", "About 9 min"))
        self.assert_outcomes("no test just above the boundary", one_sided, "PPPPPPPPPFP")

        self.assert_outcomes(
            "tests still repeat the 3-minute rule",
            with_file(solution(self.key), "test_pickup.py", starter(self.key)["test_pickup.py"]),
            "PPPPPPFPPFP")


# --------------------------------------------------------------------------- 4
REWARD_FILES = ["rewards.py", "receipt.py", "test_receipt.py"]

REAL_REWARDS_TEST = '''from order import Order
from receipt import Receipt
from rewards import Rewards


def test_receipt_shows_the_drink_and_the_points():
    lines = Receipt().lines(Order("Thai Tea", 500), Rewards())
    assert lines == ["Thai Tea  $5.00", "You earned 5 points"]
'''


class RewardsLesson(GraderCase):
    key = "rewards"

    def test_starter_and_model_solution(self):
        self.assert_outcomes("starter", starter(self.key), "FFFFPFPF")
        self.assert_outcomes("model solution", solution(self.key), "PPPPPPPP")

    def test_mistakes(self):
        # The real Rewards and the copied rule both answer 5, so this test proves nothing.
        self.assert_outcomes(
            "test passes the real Rewards",
            with_file(solution(self.key), "test_receipt.py", REAL_REWARDS_TEST),
            "PPPPPFFP")
        self.assert_outcomes(
            "analysis trusts the missing arrow",
            set_impact(solution(self.key), ["rewards.py"], ["rewards.py"]),
            "FPPPPPPP")


# --------------------------------------------------------------------------- 5
class ClubHubLesson(GraderCase):
    key = "clubhub"

    def spy_test(self):
        """Everything the model solution added to the starter's test file."""
        added = solution(self.key)["test_clubhub.py"]
        original = starter(self.key)["test_clubhub.py"]
        self.assertTrue(added.startswith(original), "the model solution should only add tests")
        return added[len(original):]

    def test_starter_and_model_solution(self):
        self.assert_outcomes("starter", starter(self.key), "FFFFFFPFFFFF")
        self.assert_outcomes("model solution", solution(self.key), "PPPPPPPPPPPP")

    def test_mistakes(self):
        model = solution(self.key)
        self.assert_outcomes(
            "no spy test",
            with_file(model, "test_clubhub.py", starter(self.key)["test_clubhub.py"]),
            "PPPPPPPPFFFP")

        spy = self.spy_test()
        assertion = [line for line in spy.splitlines() if line.strip().startswith("assert ")][-1]
        self.assert_outcomes(
            "spy test only checks that something was sent",
            patch(model, "test_clubhub.py", assertion, "    assert len(spy.sent) >= 1"),
            "PPPPPPPPPFFP")

        # Half-way state: rsvp is refactored, reminders are not, the client is still public.
        half_way = with_file(model, "reminder_service.py", starter(self.key)["reminder_service.py"])
        half_way = patch(half_way, "notifier.py", "__textly", "textly", count=3)
        self.assert_outcomes("reminders still speak Textly", half_way, "PPPPFPPFPPPP")
        self.assert_outcomes(
            "the full-event rule still has two copies",
            patch(model, "rsvp_service.py", "if event.is_full():",
                  "if len(event.guests) >= event.capacity:"),
            "PPPPPFPPPPPP")
        self.assert_outcomes(
            "designs first for the change nobody asked for",
            patch(model, "change_impact.py", 'FIX_FIRST = "A"', 'FIX_FIRST = "C"'),
            "PPFPPPPPPPPP")


del GraderCase  # the base class has no tests of its own

if __name__ == "__main__":
    unittest.main()
