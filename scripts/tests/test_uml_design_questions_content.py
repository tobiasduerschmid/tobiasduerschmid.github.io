"""Authoring contract for the "Answering Design Questions with UML" tutorial.

The design spec (docs/superpowers/specs/2026-11-20-uml-design-questions-tutorial-design.md,
§3, §7, §8.3, §9.1, and the §16 revisions) fixes properties of the hand-written
content that later edits could erode: the step order and keys, the reading
budget, the attempt each challenge asks for, the answer keys, the knowledge
checks, and the rule that a reply never states what its task asks. The two
redesigns (docs/superpowers/specs/2026-11-21-uml-design-questions-redesign.md)
made every question a decision and turned step 1 into a first challenge.

Answer keys come from tutorial_sources/uml-design-questions/facts.json, which
scripts/uml_design_questions/facts.py derives by running Headliner. The tests
below compare each key with those facts, so a change to the code that moves an
answer fails here until the content follows it.

UDQ_TUTORIAL_YAML points the tests at another copy of the YAML, such as a draft.
"""

import importlib.util
import json
import os
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
TUTORIAL_PATH = Path(os.environ.get(
    "UDQ_TUTORIAL_YAML", ROOT / "_data/tutorials/uml-design-questions.yml"))
SOURCE = TUTORIAL_PATH.read_text(encoding="utf-8")
TUTORIAL = yaml.safe_load(SOURCE)
STEPS = TUTORIAL.get("steps") or []
FACTS = json.loads((ROOT / "tutorial_sources/uml-design-questions/facts.json").read_text())
SHARED = {spec["path"]: spec["content"] for spec in TUTORIAL.get("shared_files") or []}
GLOSSARY = {entry["term"] for entry in yaml.safe_load((ROOT / "_data/glossary.yml").read_text())}

_TELLS = importlib.util.spec_from_file_location("audit_mcq_tells", ROOT / "scripts/audit_mcq_tells.py")
mcq_tells = importlib.util.module_from_spec(_TELLS)
_TELLS.loader.exec_module(mcq_tells)

STEP_KEYS = [
    "headliner",
    "event-consumers",
    "failed-trips",
    "data-model",
    "outages",
    "checkout-latency",
    "choose-the-view",
]
WARM_UP = STEP_KEYS[0]  # a small first challenge that also introduces the tools
TASK_KEYS = STEP_KEYS[1:6]  # the code-first tasks; the last step is the capstone
CODE_FIRST_KEYS = [WARM_UP] + TASK_KEYS
BUDGET_MINUTES = {WARM_UP: 5}  # the nudge in Part A; 7 minutes elsewhere
# The view each task's request asks for (spec §7.1); round two (§7.1: steps
# 4 to 6) has students predict it before the reply arrives. The warm-up's
# package diagram is drawn by the class renderer.
EXPERT_VIEW = {
    "headliner": "class",
    "event-consumers": "component",
    "failed-trips": "sequence",
    "data-model": "class",
    "outages": "component",
    "checkout-latency": "sequence",
}
PREDICTS_VIEW = {"data-model", "outages", "checkout-latency"}
# The generated diagram anchor (x-diagrams) each reply shows, in tab order.
REPLY_DIAGRAMS = {
    "headliner": ["shared_code"],
    "event-consumers": ["event_consumers"],
    "failed-trips": ["failed_trips"],
    "data-model": ["data_model"],
    "outages": ["outages"],
    "checkout-latency": ["checkout_latency"],
    "choose-the-view": [
        "capstone_website_connections",
        "capstone_trip_items",
        "capstone_cancellation",
        "capstone_gateways",
    ],
}
# The capstone's best view per question (spec §7.3); None is "no diagram".
CAPSTONE_VIEWS = {
    "rule": "component",
    "rideshare": "class",
    "cancellation": "sequence",
    "fee": None,
    "gateways": "class",
}
# Spec §7.4: knowledge checks with these many questions. Step 1's check became
# its challenge in the second redesign.
QUIZ_SIZES = {"failed-trips": 4, "checkout-latency": 5}
# Redesign spec §4.1, in order.
OBJECTIVE_VERBS = ["Analyze", "Use", "Explain", "Evaluate", "Select"]
READING_BUDGET = 300  # words of instructions before the challenge (spec §10)
LABEL_PREFIX = "Prepared in advance by an AI coding agent from this repository's code"
VERIFIED = "verified against the code"

POSITIONAL = re.compile(
    r"\b(option\s+[A-E]\b|(first|second|third|fourth|last)\s+(option|choice|answer))", re.IGNORECASE)
RUN_PROMPT = re.compile(r"(?i)\b(click|press) run\b|\brun (this|the) (snippet|code)\b|predict before you run")
CODE_SPAN = re.compile(r"`([^`]+)`")
FILE_PATH = re.compile(r"\b[\w./-]+\.(?:py|toml|md)\b")


# --- Reading the YAML ------------------------------------------------------------------


def step(key):
    for candidate in STEPS:
        if candidate.get("key") == key:
            return candidate
    raise AssertionError(f"no step with key {key!r}")


def challenge(key):
    found = step(key).get("diagram_challenge")
    assert found, f"step {key!r} has no diagram_challenge"
    return found


def question(container, question_id):
    """A question of a challenge, wherever it sits, by id."""
    for candidate in challenge_questions(container):
        if candidate.get("id") == question_id:
            return candidate
    raise AssertionError(f"no challenge question {question_id!r}")


def challenge_questions(spec):
    """Every graded question of a challenge: main, follow-up, contrast, checks, mechanism."""
    questions = list(spec.get("questions") or []) + list(spec.get("follow_up") or [])
    contrast = (spec.get("reply") or {}).get("contrast") or {}
    check = spec.get("evidence_check") or {}
    debrief = spec.get("debrief") or {}
    for extra in (contrast.get("question"), check.get("claim_question"), check.get("question"),
                  debrief.get("mechanism_question")):
        if extra:
            questions.append(extra)
    return questions


def plan_entries(spec):
    """Plan-first view choices, as questions keyed by the question they plan."""
    return [dict(entry, type="single") for entry in spec.get("plan") or []]


def correct(q):
    if q.get("type") == "multiple":
        return set(q["correct_indices"])
    return {q["correct_index"]}


def correct_options(q):
    return [q["options"][index] for index in sorted(correct(q))]


def wrong_options(q):
    return [option for index, option in enumerate(q["options"]) if index not in correct(q)]


def plain(text):
    """Option text without Markdown code marks, with dashes as hyphens."""
    return text.replace("`", "").replace("–", "-").replace("—", "-")


def component(option):
    """A component option as facts.json names it: "Warehouse ETL" is WarehouseETL."""
    return re.sub(r"[\s`]", "", option)


def mentions(text, name):
    """Whether text names a component or class, written with or without spaces."""
    spaced = re.sub(r"(?<=[a-z])(?=[A-Z])", r"\\s*", name)
    return re.search(rf"(?<![A-Za-z]){spaced}(?![A-Za-z])", text) is not None


def visible_words(markdown):
    text = re.sub(r"<[^>]+>", " ", markdown)
    return len(re.findall(r"[A-Za-z0-9_'’.()]+", text))


def section(markdown, heading):
    """The text under one `### heading`, up to the next heading."""
    match = re.search(rf"^### {re.escape(heading)}\s*\n(.*?)(?=^### |\Z)", markdown, flags=re.S | re.M)
    return match.group(1).strip() if match else None


def reply_texts(spec):
    """What the reply card says in its own words (not the diagram)."""
    reply = spec["reply"]
    texts = [reply.get(field, "") for field in ("request", "summary", "left_out", "label")]
    texts += [item["text"] for item in reply.get("evidence") or []]
    contrast = reply.get("contrast")
    if contrast:
        texts.append(contrast.get("request", ""))
    return [text for text in texts if text]


def diagram_notes(source):
    return re.findall(r"^note\b[^\n]*\n(.*?)^end note", source, flags=re.S | re.M)


def reply_diagrams(spec):
    reply = spec["reply"]
    diagrams = list(reply.get("diagrams") or [])
    if reply.get("contrast"):
        diagrams.append(reply["contrast"]["diagram"])
    return diagrams


def all_quiz_questions():
    for candidate in STEPS:
        for q in (candidate.get("quiz") or {}).get("questions") or []:
            yield candidate["key"], "quiz", q


def all_challenge_questions():
    for candidate in STEPS:
        spec = candidate.get("diagram_challenge")
        if not spec:
            continue
        for q in challenge_questions(spec):
            yield candidate["key"], q.get("id"), q
        for entry in plan_entries(spec):
            yield candidate["key"], "plan:" + str(entry.get("for")), entry


# --- Tutorial shape ----------------------------------------------------------------------


def test_step_keys_are_stable_and_unique():
    assert [candidate.get("key") for candidate in STEPS] == STEP_KEYS
    assert TUTORIAL.get("progress_version") == 3, (
        "step 1 became a challenge and a capstone question changed, so records "
        "saved under versions 1 and 2 are dropped")


def test_top_level_settings_follow_the_plan():
    assert TUTORIAL.get("backend") == "pyodide"
    assert TUTORIAL.get("require_tests") is True, "a passed challenge unlocks the next step"
    assert TUTORIAL.get("file_tree") is True
    assert TUTORIAL.get("project_search") is True
    assert TUTORIAL.get("print_unchanged_files") is False, "the codebase prints once, at step 1"
    assert TUTORIAL.get("exclude_from_index") is True, (
        "spec §14: the TA pilot runs before the tutorial is linked; the release "
        "checklist in plan Task C10 Step 4 flips this")


def test_learning_objectives_are_the_five_of_spec_section_3():
    objectives = TUTORIAL.get("learning_objectives") or []

    assert [objective.split()[0] for objective in objectives] == OBJECTIVE_VERBS


def test_every_step_carries_a_pedagogy_comment():
    lines = SOURCE.splitlines()
    for index, line in enumerate(lines):
        match = re.match(r"^  - key: (\S+)\s*$", line)
        if not match:
            continue
        above = []
        cursor = index - 1
        while cursor >= 0 and (lines[cursor].strip().startswith("#") or not lines[cursor].strip()):
            above.append(lines[cursor].strip())
            cursor -= 1
        assert any(text.startswith("# Pedagogy:") for text in above), match.group(1)


def test_every_step_shows_the_shared_read_only_codebase():
    assert SHARED, "the generated shared_files block is missing"
    for candidate in STEPS:
        assert "files" not in candidate, f'{candidate["key"]} would replace the shared codebase'
        assert candidate.get("open_file") in SHARED, candidate["key"]
        if candidate.get("run_file"):
            assert candidate["run_file"] in SHARED, candidate["key"]


def test_nothing_runs_in_the_browser():
    # Every file is read, not run: TOML or a module run as a script only fails.
    assert TUTORIAL.get("run") is False
    for candidate in STEPS:
        assert "run_file" not in candidate, candidate["key"]
        assert "**Run**" not in candidate["instructions"], candidate["key"]


def repro_output(module):
    """What a repro script prints when run from Headliner's root."""
    headliner = ROOT / "tutorial_sources/uml-design-questions/headliner"
    result = subprocess.run(
        [sys.executable, "-m", module], cwd=headliner, capture_output=True, text=True, check=True)
    return result.stdout.rstrip("\n")


def test_the_bug_steps_show_their_repro_scripts_output():
    for key, script, module in (
        ("failed-trips", "scenarios/failed_trip.py", "scenarios.failed_trip"),
        ("checkout-latency", "scenarios/slow_group_checkout.py", "scenarios.slow_group_checkout"),
    ):
        candidate = step(key)
        assert candidate.get("open_file") == script, key
        # The script stays open as evidence; its output is shown as text.
        assert f"`{script}`" in candidate["instructions"], key
        blocks = re.findall(r"```text\n(.*?)\n *```", candidate["instructions"], re.S)
        shown = ["\n".join(line.strip() for line in block.splitlines()) for block in blocks]
        expected = "\n".join(line.strip() for line in repro_output(module).splitlines())
        assert expected in shown, key


# --- Instructions ------------------------------------------------------------------------


def test_each_step_opens_with_motivation_and_objectives():
    for candidate in STEPS:
        text = candidate["instructions"]
        assert text.startswith("### Why this matters\n"), candidate["key"]
        why = section(text, "Why this matters")
        assert why and len(why.split()) <= 60, f'{candidate["key"]}: one short paragraph'
        goals = section(text, "🎯 You will learn to")
        assert goals is not None, f'{candidate["key"]}: missing the 🎯 list'
        bullets = [line for line in goals.splitlines() if line.startswith("- ")]
        assert 1 <= len(bullets) <= 3, (candidate["key"], bullets)


def test_instructions_stay_within_300_words_per_step_before_the_challenge():
    for candidate in STEPS:
        words = visible_words(candidate["instructions"])
        assert words <= READING_BUDGET, f'{candidate["key"]}: {words} words'


# --- Challenges --------------------------------------------------------------------------


def test_every_step_has_a_challenge():
    for key in STEP_KEYS:
        assert challenge(key)


def test_code_first_challenges_ask_for_a_real_attempt():
    # Spec §16 (review C1): a hypothesis before the options, a pinned line, a view wish.
    for key in CODE_FIRST_KEYS:
        spec = challenge(key)
        assert spec.get("mode", "code-first") == "code-first", key
        assert spec.get("budget_minutes") == BUDGET_MINUTES.get(key, 7), key
        assert spec.get("min_score") == 0.8, key
        attempt = spec.get("attempt") or {}
        assert attempt.get("hypothesis") is True, key
        assert attempt.get("evidence_pins", 0) >= 1, key
        assert attempt.get("view_wish") is True, key


def test_round_two_predicts_the_view_that_the_expert_asks_for():
    for key, view in EXPERT_VIEW.items():
        spec = challenge(key)
        assert bool(spec.get("predict_view")) == (key in PREDICTS_VIEW), key
        assert spec["reply"]["diagrams"][0]["type"] == view, key


def test_the_outage_reply_contrasts_the_package_view_first():
    contrast = challenge("outages")["reply"].get("contrast") or {}

    assert contrast.get("diagram", {}).get("type") == "class"
    assert contrast["diagram"]["source"] == TUTORIAL["x-diagrams"]["outages_imports"]
    assert contrast.get("question", {}).get("type") == "single"


def test_each_reply_shows_its_generated_diagrams():
    diagrams = TUTORIAL.get("x-diagrams") or {}
    for key, names in REPLY_DIAGRAMS.items():
        shown = challenge(key)["reply"]["diagrams"]
        assert [diagram["source"] for diagram in shown] == [diagrams[name] for name in names], key
        ids = [diagram.get("id") for diagram in shown]
        assert all(ids) and len(set(ids)) == len(ids), key
        if len(shown) > 1:
            assert all(diagram.get("label") for diagram in shown), f"{key}: tabs need labels"


def test_reply_cards_are_complete():
    # Spec §8.3: request, summary, diagram, evidence, files read, left out, label.
    for key in REPLY_DIAGRAMS:
        reply = challenge(key)["reply"]
        for field in ("request", "summary", "left_out", "label"):
            assert (reply.get(field) or "").strip(), f"{key}: reply.{field}"
        assert reply.get("evidence"), f"{key}: reply.evidence"
        assert reply.get("files_read"), f"{key}: reply.files_read"
        for path in reply["files_read"]:
            assert path in SHARED, f"{key}: {path}"


def test_reply_labels_say_how_each_diagram_was_made():
    # Spec §8.3 and §7.3: the capstone's reply holds the one deliberate omission,
    # so its label does not claim verification. No staff sign-off is recorded yet.
    for key in REPLY_DIAGRAMS:
        label = challenge(key)["reply"]["label"]
        assert label.startswith(LABEL_PREFIX), key
        assert (VERIFIED in label) == (key != "choose-the-view"), key
        assert "course staff" not in label, key


def test_every_evidence_note_points_at_a_line_that_shows_what_it_names():
    for key in REPLY_DIAGRAMS:
        for item in challenge(key)["reply"]["evidence"]:
            path, _, line = item["ref"].rpartition(":")
            assert path in SHARED, f'{key}: {item["ref"]}'
            lines = SHARED[path].splitlines()
            assert line.isdigit() and 1 <= int(line) <= len(lines), f'{key}: {item["ref"]}'
            spans = [span.removesuffix("()") for span in CODE_SPAN.findall(item["text"])]
            assert spans, f'{key}: name the symbol in `code`: {item["text"]!r}'
            assert any(span in lines[int(line) - 1] for span in spans), (
                f'{key}: {item["ref"]} shows none of {spans}')


def test_challenge_question_ids_are_unique_within_each_challenge():
    for key in REPLY_DIAGRAMS:
        ids = [q.get("id") for q in challenge_questions(challenge(key))]
        assert all(ids) and len(set(ids)) == len(ids), (key, ids)


def test_every_challenge_ends_with_a_debrief_and_a_mechanism_question():
    for key in REPLY_DIAGRAMS:
        debrief = challenge(key).get("debrief") or {}
        for field in ("hidden_by", "find_in_code", "view_shows", "consolidation_prompt"):
            assert (debrief.get(field) or "").strip(), f"{key}: debrief.{field}"
        mechanism = debrief.get("mechanism_question") or {}
        assert mechanism.get("type") == "single" and len(mechanism.get("options") or []) >= 3, key


def test_the_mechanism_questions_interleave_the_same_mechanisms():
    # Objective 3: each task names the mechanism that hid its answer; every
    # mechanism question offers mechanisms the other tasks had, so choosing
    # one is a discrimination, not a recall of the current step.
    keys = [plain(correct_options(challenge(key)["debrief"]["mechanism_question"])[0]) for key in TASK_KEYS]
    assert len(set(keys)) == len(keys), keys
    offered_later = set()
    for key in TASK_KEYS:
        offered = {plain(option) for option in challenge(key)["debrief"]["mechanism_question"]["options"]}
        assert len(offered & set(keys)) >= 3, key
        offered_later |= offered
    # The warm-up's mechanism comes back as a choice in a later task. Its own
    # question offers no later mechanism, which would name a later answer.
    warm_up = challenge(WARM_UP)["debrief"]["mechanism_question"]
    [warm_up_key] = [plain(option) for option in correct_options(warm_up)]
    assert warm_up_key in offered_later and warm_up_key not in keys
    assert not {plain(option) for option in wrong_options(warm_up)} & offered_later


def message_sender(key):
    """Who asks a step's question: "Rin" in `> **Rin, platform team:**`."""
    return re.search(r"^> \*\*([^,:*]+)", step(key)["instructions"], flags=re.M).group(1)


def test_code_first_debriefs_judge_a_claim_and_end_with_a_reply():
    # Second redesign: each mechanism question quotes someone's reasoning to
    # judge, and the closing sentence answers the person who asked.
    stems = [challenge(key)["debrief"]["mechanism_question"]["question"] for key in CODE_FIRST_KEYS]
    assert len(set(stems)) == len(stems), "each step judges its own claim"
    for key, stem in zip(CODE_FIRST_KEYS, stems):
        assert stem.rstrip().endswith("?") and "Which mechanism hid" not in stem, key
        prompt = challenge(key)["debrief"]["consolidation_prompt"]
        assert message_sender(key).lower() in prompt.lower(), f"{key}: reply to {message_sender(key)}"


def test_evidence_checks_fade_from_naming_the_file_to_naming_nothing():
    # Spec §16 (review C3, M7): T3 says what to check, T5 names the claim and
    # the student finds the file, the capstone first asks which claim to check.
    failed = challenge("failed-trips")["evidence_check"]
    assert any(path in SHARED for path in FILE_PATH.findall(plain(failed["prompt"])))
    for key in ("outages", "choose-the-view"):
        check = challenge(key)["evidence_check"]
        prose = " ".join([check["prompt"], check["question"]["question"], *check["question"]["options"]])
        assert not FILE_PATH.findall(plain(prose)), key
    assert "claim_question" in challenge("choose-the-view")["evidence_check"]
    assert "claim_question" not in failed
    assert "claim_question" not in challenge("outages")["evidence_check"]


def test_the_capstone_plans_one_view_per_question():
    spec = challenge("choose-the-view")
    assert spec.get("mode") == "plan-first"
    assert spec.get("min_score") == 0.8
    assert [q["id"] for q in spec["questions"]] == list(CAPSTONE_VIEWS)
    assert [entry.get("for") for entry in spec["plan"]] == list(CAPSTONE_VIEWS)
    for entry in plan_entries(spec):
        best = CAPSTONE_VIEWS[entry["for"]]
        [key_option] = correct_options(entry)
        if best:
            assert key_option.startswith(f"A {best} diagram"), entry["for"]
        else:
            assert key_option.startswith("No diagram"), entry["for"]
            [path] = FILE_PATH.findall(plain(key_option))
            assert "SERVICE_FEE_RATE" in SHARED[path]
    shown = [diagram["type"] for diagram in spec["reply"]["diagrams"]]
    assert shown == [view for view in CAPSTONE_VIEWS.values() if view]


# --- Answer keys come from the facts -------------------------------------------------------


# Judgment keys (redesign spec §5.1) choose among design alternatives. Their
# tests pin the facts each choice rests on, never the choice itself.


def test_shared_code_keys_match_what_each_service_loads():
    spec = challenge(WARM_UP)
    shared = FACTS["shared_code"]
    loads_http = {name for name, modules in shared["loads"].items() if "http" in modules}

    redeploy = question(spec, "redeploy")
    assert {component(option) for option in redeploy["options"]} == set(shared["loads"]), (
        "every service is a choice")
    assert {component(option) for option in correct_options(redeploy)} == loads_http
    # What makes the question worth asking: a search for the module finds fewer.
    assert set(shared["imports"]["http"]) < loads_http
    assert set(shared["takes_only_message"]) == loads_http - set(shared["imports"]["http"])
    # A change to the broker's module reaches every service but one.
    spared = set(shared["loads"]) - {name for name, modules in shared["loads"].items() if "broker" in modules}
    [release] = correct_options(question(spec, "broker-release"))
    assert {component(release.removeprefix("The ").removesuffix(" only"))} == spared
    # Judgment key: the three need one data class, which runs without the module's imports.
    decouple = question(spec, "decouple")
    assert names_all(decouple["question"], shared["takes_only_message"]) and "`Message`" in decouple["question"]
    assert shared["message_stands_alone"]
    [moved] = correct_options(decouple)
    assert "`Message`" in moved and "imports no Headliner code" in moved
    assert not any("`Message` into" in option for option in wrong_options(decouple))
    # No service imports another service's code.
    assert shared["service_to_service_imports"] == []
    [alone] = correct_options(question(spec, "alone"))
    assert alone.startswith("None")
    assert sum(option.startswith("None") for option in question(spec, "alone")["options"]) == 1


def test_event_consumer_keys_match_what_the_rename_breaks():
    spec = challenge("event-consumers")
    consumers = FACTS["event_consumers"]
    breaks = question(spec, "breaks")

    assert {component(option) for option in correct_options(breaks)} == set(consumers["rename_breaks"])
    offered = {component(option) for option in breaks["options"]}
    assert set(consumers["trip.confirmed"]) | set(consumers["trip.cancelled"]) <= offered, (
        "every receiver of a trip event is a choice")
    # Judgment key: adding the fields breaks no consumer; removing fan_name comes later.
    [rollout] = correct_options(question(spec, "rollout"))
    assert consumers["additive_breaks"] == [] and "keep `fan_name`" in rollout
    assert not any("keep" in option for option in wrong_options(question(spec, "rollout")))
    versioned = question(spec, "versioned-key")
    assert "trip.confirmed.v2" in versioned["question"]
    assert [component(option.removesuffix(" only")) for option in correct_options(versioned)] == (
        consumers["trip.confirmed.v2"])
    assert {component(option) for option in correct_options(question(spec, "privacy"))} == set(
        consumers["external_forwarders"])


def test_failed_trip_keys_match_the_traced_rejection():
    spec = challenge("failed-trips")
    facts = FACTS["failed_trips"]

    [money] = correct_options(question(spec, "money"))
    assert ("stays captured" in money) == (facts["refunds"] == 0)
    assert ("cannot be cancelled" in money) == (not facts["fan_can_cancel"])
    assert not any("cannot be cancelled" in option for option in wrong_options(question(spec, "money")))
    # The rejection path lacks a refund and a cancellation, and suppliers still
    # confirm after the trip failed, so a fix must cover orders not yet answered.
    assert [missing.split()[0] for missing in facts["missing"]] == ["refund", "cancel"]
    assert facts["confirmed_after_failure"], "the premise that rules out 'confirmed so far'"
    fix = question(spec, "fix")
    [key] = correct_options(fix)
    assert "Refund" in key and "not yet rejected" in key
    assert sum("so far" in option for option in wrong_options(fix)) == 1
    # Judgment key: capturing last can meet a declined capture, because the
    # checkout asks the bank only whether the card is open.
    assert facts["card_check_amount"] == 0 and facts["capture_before_first_answer"]
    [capture_last] = correct_options(question(spec, "capture-last"))
    assert "declined" in capture_last
    [checked] = correct_options(spec["evidence_check"]["question"])
    assert not any(verb in checked.lower() for verb in ("refund", "cancel")), (
        "the code's reject branch lacks them")


def test_data_model_keys_match_the_model():
    spec = challenge("data-model")
    ideas = question(spec, "ideas")
    # The options are the product team's six ideas in spec order (§7.2, T4),
    # which facts.py numbers 1 to 6.
    assert len(ideas["options"]) == 6
    assert sorted(ideas["correct_indices"]) == [number - 1 for number in FACTS["data_model"]["allowed"]]
    # One association changes, and a reader outside the model exists (My trips).
    assert FACTS["data_model"]["split_payment_multiplicity"] == "TripOrder-Payment"
    assert FACTS["capstone"]["my_trips_reads_stored_payment"]
    scope = question(spec, "split-scope")
    assert [("1..*" in option, "omits" in option) for option in scope["options"]].count((True, True)) == 1
    [key] = correct_options(scope)
    assert "1..*" in key and "omits" in key


# The four maintenance windows of the outage task, as facts.json names them.
WINDOWS = {"Bank": "bank", "Lodging Provider": "lodging", "Message broker": "broker", "Mail Relay": "mail_relay"}
UNLISTED = {"Box Office": "box_office", "Shuttle Provider": "shuttle", "Experience Provider": "experiences"}


def test_outage_keys_match_the_outage_runs():
    spec = challenge("outages")
    outages = FACTS["outages"]
    presale = FACTS["presale_path"]

    windows = question(spec, "windows")
    assert windows["options"] == list(WINDOWS)
    assert set(correct_options(windows)) == {
        name for name, service in WINDOWS.items() if outages[service] == "cannot_submit"}
    # An order placed during the lodging window: taken, charged, finished afterwards.
    assert outages["lodging"] == "finish_afterwards" and presale["lodging_charged_while_waiting"]
    lodging = question(spec, "lodging-order")
    [key] = correct_options(lodging)
    assert "charged now" in key and "once the provider is back" in key
    assert not any("charged now" in option for option in wrong_options(lodging))
    unlisted = question(spec, "unlisted")
    for name, service in UNLISTED.items():
        assert name in unlisted["options"], name
        assert (name in correct_options(unlisted)) == (presale[service] == "cannot_submit"), name
    assert len(correct_options(unlisted)) == 1
    # The submit request waits for the broker exactly when a broker outage stops orders.
    [checked] = correct_options(spec["evidence_check"]["question"])
    assert checked.startswith("Yes") == (outages["broker"] == "cannot_submit")
    [fits] = correct_options(spec["reply"]["contrast"]["question"])
    assert fits.startswith("No"), "imports cannot show the calls a request waits for"


def checkout_seconds(option):
    """How long the group checkout takes under the change an option names."""
    latency = FACTS["checkout_latency"]
    bulk, parallel = "bulk" in option, "parallel" in option
    if bulk and parallel:
        return latency["variants"]["bulk_parallel"]
    if bulk and "cached" in option:
        return latency["variants"]["bulk_cached_card"]
    if parallel:
        return latency["variants"]["parallel_only"]
    assert not bulk and "OPC" in option, f"no timed variant for {option!r}"
    return latency["elapsed_seconds"]  # the same calls, made from another place


def test_checkout_latency_keys_match_the_call_log():
    spec = challenge("checkout-latency")
    latency = FACTS["checkout_latency"]
    target = 2.0

    # Most of the time goes to the two loops.
    assert latency["quote_seconds"] + latency["check_seconds"] > 0.9 * latency["elapsed_seconds"]
    [budget] = correct_options(question(spec, "budget"))
    assert "pass quotes" in budget and "capacity checks" in budget
    fix = question(spec, "fix")
    for index, option in enumerate(fix["options"]):
        assert (checkout_seconds(option) < target) == (index == fix["correct_index"]), option
    # Dropping the checks meets the target too; a rejection then follows the capture.
    assert latency["variants"]["bulk_no_checks"] < target
    assert latency["rejected_experience_is_charged_and_failed"]
    [trade_off] = correct_options(question(spec, "trade-off"))
    assert "after the capture" in trade_off and "Failed" in trade_off


def test_capstone_keys_match_the_code():
    spec = challenge("choose-the-view")
    capstone = FACTS["capstone"]
    contracts = FACTS["gateway_contracts"]
    stuck = capstone["stuck_cancellation"]

    [rule] = correct_options(question(spec, "rule"))
    assert rule.startswith("No") == capstone["website_reads_order_db"]
    # A new kind of item is listed by name in two modules, in two services:
    # an order that names an unlisted type cannot be read.
    listed = FACTS["diagrams"]["trip_items"]["listed_by"]
    assert set(listed) == {"services::opc::payloads", "services::website::checkout"}
    assert listed["services::opc::payloads"] == listed["services::website::checkout"]
    assert capstone["unlisted_item_type_is_refused"]
    rideshare = question(spec, "rideshare")
    [both] = correct_options(rideshare)
    assert "`ITEM_TYPES`" in both and "`_item`" in both
    assert [("`ITEM_TYPES`" in option, "`_item`" in option) for option in wrong_options(rideshare)].count(
        (True, False)) == 1, "one choice stops at the OPC's list"
    cancellation = question(spec, "cancellation")
    [key] = correct_options(cancellation)
    assert key.startswith("Refunded") == (stuck["refunds"] == 1 and capstone["refund_before_cancel"])
    assert ("stays booked" in key) == (stuck["tent"] == "confirmed")
    # One module constant, not a per-festival setting.
    [fee] = correct_options(question(spec, "fee"))
    assert "one rate constant" in fee
    assert f'SERVICE_FEE_RATE = {capstone["service_fee"]}' in SHARED["services/website/pricing.py"]
    # Judgment key: two gateways break the contract of cancel(), so the rule
    # belongs in the contract. Its explanation names the two.
    gateways = question(spec, "gateways")
    assert gateways["type"] == "single"
    [placed] = correct_options(gateways)
    assert "`SupplierGateway` contract" in placed
    assert names_all(gateways["explanation"], contracts["fails_cancel_when_online"])
    # Judgment key: the view for an outage question about an unfamiliar system.
    [transfer] = correct_options(question(spec, "transfer"))
    assert transfer.startswith("A component diagram") and "code" in transfer
    check = spec["evidence_check"]
    [checked] = correct_options(check["question"])
    assert checked.startswith("No") == capstone["website_reads_order_db"]
    [claim] = correct_options(check["claim_question"])
    assert "every connection" in claim


# --- Replies never state the answer --------------------------------------------------------


def names_all(text, names):
    return all(mentions(text, name) for name in names)


def leaks(key):
    """Predicates for statements of a task's answer, built from facts.json."""
    consumers = FACTS["event_consumers"]
    contracts = FACTS["gateway_contracts"]
    verbs = [missing.split()[0] for missing in FACTS["failed_trips"]["missing"]]
    calls = FACTS["checkout_latency"]["external_calls"]
    shared = FACTS["shared_code"]
    return {
        "headliner": [
            lambda text: re.search(r"\b(all|every)\s+(eight\s+)?services?\b|\beight services\b", text, re.I),
            lambda text: names_all(text, shared["takes_only_message"]) and "http" in text,
            lambda text: re.search(r"Loyalty[^.]*infra/http|infra/http[^.]*Loyalty", text),
        ],
        "event-consumers": [
            lambda text: names_all(text, consumers["trip.confirmed"]),
            lambda text: names_all(text, consumers["trip.cancelled"]),
            lambda text: names_all(text, consumers["rename_breaks"]),
            lambda text: any(mentions(text, name) for name in consumers["external_forwarders"])
            and "fan_name" in text,
        ],
        "failed-trips": [
            lambda text: any(re.search(rf"\b{verb}", text, re.I) for verb in verbs),
            lambda text: re.search(r"captur\w*[^.]*\bbefore\b|\bbefore\b[^.]*\bconfirm", text, re.I),
        ],
        "data-model": [
            lambda text: re.search(r"Payment[^.]*1\.\.\*|1\.\.\*[^.]*Payment", text),
        ],
        "outages": [
            lambda text: re.search(r"cannot (submit|order)|can't (submit|order)|after the window"
                                   r"|e-?mails? (only )?wait|no outbox|should (store|save)", text, re.I),
        ],
        "checkout-latency": [
            lambda text: re.search(rf"\b({calls}|nine)\b[^.]*\bcalls?\b|\bcalls?\b[^.]*\b({calls}|nine)\b", text),
            lambda text: re.search(r"\bparallel|\bconcurrent", text, re.I),
        ],
        "choose-the-view": [
            lambda text: re.search(r"replica|ORDER_HISTORY|order[_ ]history|My trips", text, re.I),
            lambda text: "Rideshare" in text,
            lambda text: re.search(r"refund\w*\s+(comes\s+)?(first|before)", text, re.I),
            lambda text: re.search(r"\bstays?\s+booked|still booked", text, re.I),
            lambda text: re.search(r"0\.12|\b12\s?%|twelve percent", text, re.I),
            lambda text: names_all(text, contracts["fails_cancel_when_online"]),
            lambda text: names_all(text, contracts["experience_place_inheritors"]),
        ],
    }[key]


def test_no_reply_summary_or_diagram_note_states_a_task_key():
    # Spec §3 anti-goal and §8.2 rule 3: notes report facts, never the conclusion.
    for key in REPLY_DIAGRAMS:
        spec = challenge(key)
        texts = reply_texts(spec)
        for diagram in reply_diagrams(spec):
            texts += diagram_notes(diagram["source"])
        for text in texts:
            for leak in leaks(key):
                assert not leak(text), f"{key}: {text!r}"


# --- Knowledge checks ----------------------------------------------------------------------


def test_knowledge_checks_sit_on_steps_3_and_6():
    for number, candidate in enumerate(STEPS, start=1):
        quiz = candidate.get("quiz")
        if candidate["key"] not in QUIZ_SIZES:
            assert quiz is None, candidate["key"]
            continue
        assert quiz["title"] == f"Step {number} — Knowledge Check"
        assert quiz["min_score"] == 0.8
        assert len(quiz["questions"]) == QUIZ_SIZES[candidate["key"]], candidate["key"]


def test_the_first_challenge_names_no_place_that_hides_a_later_answer():
    # Spec §16: step 1 must not hand out a later task's answer, so what a
    # learner reads there never points at the places that hide one (spec
    # §5.2, §7.3). The agent's list of files it read is not prose.
    hiding_places = [
        "broker.toml", "services.toml", "website.toml", "consumes", "binding",
        "consumers.py", "invoice_task", "supplier_task", "workflow", "intake",
        "rules.py", "payments.py", "pricing.py", "availability.py", "order_history",
        "partners/", "cancellation",
    ]
    spec = challenge(WARM_UP)
    prose = [step(WARM_UP)["instructions"], *reply_texts(spec)]
    prose += [value for value in spec["debrief"].values() if isinstance(value, str)]
    for q in challenge_questions(spec):
        prose += [q["question"], q.get("explanation", ""), *q["options"],
                  *(q.get("option_feedback") or {}).values()]
    for diagram in reply_diagrams(spec):
        prose += diagram_notes(diagram["source"])
        prose += [link["path"] for link in diagram.get("links") or []]
    for text in prose:
        for place in hiding_places:
            assert place not in text, (place, text[:80])


def check_quiz_format(where, q, quiz):
    options = q.get("options") or []
    assert q.get("type") in {"single", "multiple"}, where
    assert len(options) >= 3, where
    assert all("\n\n" not in option for option in options), f"{where}: options render inline"
    keys = correct(q)
    assert keys and keys <= set(range(len(options))), where
    feedback = q.get("option_feedback") or {}
    assert feedback, f"{where}: explain at least one tempting wrong option"
    assert set(feedback) <= set(range(len(options))), where
    if q["type"] == "single":
        assert not set(feedback) & keys, f"{where}: a single-choice key gets no option feedback"
    assert not set(feedback) & set(q.get("optional_indices") or []), where
    prose = " ".join([q.get("question", ""), q.get("explanation", ""), *map(str, feedback.values())])
    assert not POSITIONAL.search(prose), f"{where}: refer to options by content"
    assert "misconception" not in prose.lower(), where
    if quiz:
        assert q.get("explanation", "").strip(), f"{where}: a knowledge check explains its key"
        assert not RUN_PROMPT.search(prose), f"{where}: quiz snippets cannot be run"
    tell = mcq_tells.analyze_question(dict(q, question=q.get("question", "")))
    assert tell is None, f"{where}: the key is telegraphed: {tell}"


def test_knowledge_check_questions_follow_quiz_format():
    for key, where, q in all_quiz_questions():
        check_quiz_format(f"{key} {where}: {q['question'][:50]}", q, quiz=True)


def test_challenge_questions_follow_quiz_format():
    for key, question_id, q in all_challenge_questions():
        check_quiz_format(f"{key} {question_id}", q, quiz=False)


def test_challenge_keys_do_not_gather_at_one_position():
    # Challenge options keep their authored order (the runtime never shuffles
    # them), so a position that usually holds the key would answer by itself.
    positions = Counter(q["correct_index"] for _, _, q in all_challenge_questions() if q.get("type") == "single")
    assert positions and max(positions.values()) <= sum(positions.values()) / 3, positions


# --- Pages and glossary --------------------------------------------------------------------


def front_matter(path):
    text = (ROOT / path).read_text()
    assert text.startswith("---\n"), path
    return yaml.safe_load(text.split("---\n")[1])


def test_the_live_and_print_pages_form_a_pair():
    live = front_matter("SEBook/tools/uml-design-questions.md")
    printed = front_matter("SEBook/tools/uml-design-questions/print.md")

    assert live["layout"] == "tutorial" and printed["layout"] == "print-tutorial"
    assert live["tutorial"] == printed["tutorial"] == "uml-design-questions"
    assert live["permalink"] == "/SEBook/tools/uml-design-questions"
    assert printed["permalink"] == live["permalink"] + "/print"
    # Combined course pages load ArchUML for these diagrams only with this flag.
    assert live.get("uml_code_labs") is True and printed.get("uml_code_labs") is True


def learner_prose():
    """Everything a learner reads in this tutorial's own words, without code."""
    texts = [TUTORIAL.get("description", "")]
    for candidate in STEPS:
        texts.append(candidate["instructions"])
        for q in (candidate.get("quiz") or {}).get("questions") or []:
            texts += [q["question"], q.get("explanation", ""), *q["options"],
                      *(q.get("option_feedback") or {}).values()]
        spec = candidate.get("diagram_challenge")
        if not spec:
            continue
        for q in challenge_questions(spec) + plan_entries(spec):
            texts += [q.get("question", ""), q.get("explanation", ""), *q["options"],
                      *(q.get("option_feedback") or {}).values()]
        texts += reply_texts(spec)
        texts += [value for value in (spec.get("debrief") or {}).values() if isinstance(value, str)]
        texts.append((spec.get("evidence_check") or {}).get("prompt", ""))
        for diagram in reply_diagrams(spec):
            texts += diagram_notes(diagram["source"])
    return texts


def test_every_abbreviation_in_the_tutorial_has_a_glossary_entry():
    missing = set()
    for text in learner_prose():
        text = re.sub(r"```.*?```", " ", str(text), flags=re.S)
        text = re.sub(r"`[^`]*`|<[^>]+>|\([\w./-]+:\d+[^)]*\)|\b[\w/-]+\.(?:py|toml|md)\b", " ", text)
        for token in re.findall(r"\b[A-Z][A-Z0-9]+(?:s)?\b", text):
            if token not in GLOSSARY and token.removesuffix("s") not in GLOSSARY:
                missing.add(token)
    assert not missing, f"add these to _data/glossary.yml: {sorted(missing)}"
