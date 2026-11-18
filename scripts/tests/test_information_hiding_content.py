"""Authoring contract for the Information Hiding tutorial.

The lesson design fixes a few properties that are easy to erode in later
edits: the lesson order and stable keys, the reading budget, the
think / refactor / test / reason loop, and the shape of hints and knowledge
checks. Each test below states one of those properties.
"""

import os
from pathlib import Path
import re
import unittest

import yaml


ROOT = Path(__file__).resolve().parents[2]
TUTORIAL_PATH = Path(os.environ.get(
    "IH_TUTORIAL_YAML", ROOT / "_data/tutorials/information-hiding.yml"))
SOURCE = TUTORIAL_PATH.read_text()
TUTORIAL = yaml.safe_load(SOURCE)
STEPS = TUTORIAL["steps"]

LESSON_KEYS = ["payments", "menu", "wait-times", "rewards", "clubhub"]
# Words a learner reads per lesson, diagrams excluded. The tutorial this one
# replaces averaged 677; the design caps the first lesson (which also teaches
# the tools) at 420 and every later lesson at 350.
READING_BUDGET = [420, 350, 350, 350, 350]
LADDER_LABELS = re.compile(r"^(orient|strategy|skeleton|layer\s*\d+)\b", re.IGNORECASE)
POSITIONAL = re.compile(r"\b(option\s+[A-E]\b|(first|second|third|fourth|last)\s+(option|choice|answer))",
                        re.IGNORECASE)


def visible_words(markdown):
    text = re.sub(r'<div class="uml-class-diagram-container".*?</div>', " ", markdown, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    return len(re.findall(r"[A-Za-z0-9_'’.()]+", text))


def section(markdown, heading):
    """The text under one `### heading`, up to the next heading."""
    match = re.search(rf"^### {re.escape(heading)}\s*\n(.*?)(?=^### |\Z)", markdown, flags=re.S | re.M)
    return match.group(1).strip() if match else None


class TutorialShape(unittest.TestCase):
    def test_lessons_keep_their_order_and_stable_keys(self):
        self.assertEqual([step.get("key") for step in STEPS], LESSON_KEYS)
        self.assertTrue(TUTORIAL.get("progress_version"),
                        "without progress_version an old numeric save would credit the new lessons")

    def test_every_lesson_file_is_local_to_its_lesson(self):
        for step in STEPS:
            for file in step["files"]:
                self.assertIs(file.get("reseed"), True, f'{step["key"]}/{file["path"]}')

    def test_nothing_is_left_unwritten(self):
        self.assertNotIn("TODO(", SOURCE)
        for step in STEPS:
            self.assertTrue(step["solution"].get("explanation", "").strip(), step["key"])


class Instructions(unittest.TestCase):
    def test_each_lesson_opens_with_motivation_and_objectives(self):
        for step in STEPS:
            with self.subTest(lesson=step["key"]):
                text = step["instructions"]
                self.assertTrue(text.startswith("### Why this matters\n"))
                why = section(text, "Why this matters")
                self.assertLessEqual(len(why.split()), 60, "the motivation is one short paragraph")
                goals = section(text, "🎯 You will learn to")
                self.assertIsNotNone(goals, "missing the 🎯 You will learn to list")
                bullets = [line for line in goals.splitlines() if line.startswith("- ")]
                self.assertTrue(1 <= len(bullets) <= 3, bullets)

    def test_each_lesson_stays_within_its_reading_budget(self):
        for step, budget in zip(STEPS, READING_BUDGET):
            with self.subTest(lesson=step["key"]):
                self.assertLessEqual(visible_words(step["instructions"]), budget)

    def test_each_lesson_runs_the_whole_loop(self):
        # Think about the change, make it, test it, reason about the impact.
        for step in STEPS:
            with self.subTest(lesson=step["key"]):
                tasks = section(step["instructions"], "Your tasks")
                self.assertIsNotNone(tasks, "missing the numbered task list")
                labels = re.findall(r"^\d+\. \*\*([^*]+?)\.?\*\*", tasks, flags=re.M)
                self.assertEqual(labels[0], "Think")
                self.assertEqual(labels[-1], "Reason")
                self.assertTrue(any(label.startswith("Test") for label in labels), labels)
                self.assertIn("change_impact.py", step["instructions"])


class Checks(unittest.TestCase):
    def test_every_check_has_a_graduated_hint_ladder(self):
        for step in STEPS:
            for check in step["tests"]:
                with self.subTest(lesson=step["key"], check=check["description"]):
                    hints = check.get("hints") or []
                    self.assertGreaterEqual(len(hints), 3)
                    for hint in hints:
                        self.assertTrue(hint.get("text", "").strip())
                        self.assertFalse(LADDER_LABELS.match(hint.get("title", "")),
                                         "a hint title names its advice, not its rung")

    def test_the_first_and_last_checks_are_the_change_impact_analysis(self):
        for step in STEPS:
            with self.subTest(lesson=step["key"]):
                descriptions = [check["description"] for check in step["tests"]]
                self.assertTrue(descriptions[0].startswith("Before:"))
                self.assertTrue(descriptions[-1].startswith("After:"))


class KnowledgeChecks(unittest.TestCase):
    def test_quiz_format(self):
        for number, step in enumerate(STEPS, start=1):
            quiz = step["quiz"]
            with self.subTest(lesson=step["key"]):
                self.assertEqual(quiz["title"], f"Step {number} — Knowledge Check")
                self.assertEqual(quiz["min_score"], 0.8)
                self.assertTrue(4 <= len(quiz["questions"]) <= 5)

    def test_questions_are_complete_and_shuffle_safe(self):
        for step in STEPS:
            for index, question in enumerate(step["quiz"]["questions"]):
                with self.subTest(lesson=step["key"], question=index):
                    self.assertIn(question["type"], {"single", "multiple"})
                    options = question["options"]
                    self.assertGreaterEqual(len(options), 4)
                    if question["type"] == "single":
                        correct = {question["correct_index"]}
                    else:
                        correct = set(question["correct_indices"])
                    self.assertTrue(correct and correct <= set(range(len(options))))
                    feedback = question.get("option_feedback") or {}
                    self.assertTrue(set(feedback) <= set(range(len(options))) - correct,
                                    "feedback belongs to wrong options only")
                    self.assertTrue(feedback, "explain at least one tempting wrong option")
                    self.assertTrue(question.get("explanation", "").strip())
                    prose = " ".join([question["question"], question["explanation"], *feedback.values()])
                    self.assertFalse(POSITIONAL.search(prose), "options shuffle: refer to them by content")
                    self.assertNotIn("misconception", prose.lower())
                    self.assertNotRegex(prose, r"(?i)\b(click|press) run\b|\brun (this|the) (snippet|code)\b",
                                        "quiz snippets cannot be run")


if __name__ == "__main__":
    unittest.main()
