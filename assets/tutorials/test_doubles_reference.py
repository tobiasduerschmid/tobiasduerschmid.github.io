"""Independent contract implementation used to assess test-double exercises.

This runs only in the grading sandbox; the learner's implementation is restored
after each check. Deliberate variants change one observable behavior at a time.
"""

import datetime


def is_today_event_day(event_date_str, clock=datetime.datetime):
    return clock.now().strftime("%Y-%m-%d") == event_date_str


def send_push(user_id, message):
    # The real tutorial adapter also only prints. Never send a notification.
    print(f"Reference notification: {user_id!r}, {message!r}")


QUEST_REWARDS = {
    "Slay the Slime Lord": 100,
    "Find the Lost Amulet": 150,
    "Battle the Lich King": 250,
    "Defeat the Dragon": 500,
}


class DailyQuestService:
    def __init__(self, clock, api, ledger=None):
        self._clock = clock
        self._api = api
        self._ledger = ledger

    def daily_quest_title(self, user_id):
        try:
            quests = self._api.fetch_quests(user_id)
        except ConnectionError:
            return "No quests today"  # unavailable API
        weekday = self._clock.now().strftime("%A")
        for quest in quests:
            if quest["weekday"] == weekday:
                return quest["title"]
        return "No quests today"  # no matching quest

    def complete_quest(self, user_id, quest_title):
        gold = QUEST_REWARDS.get(quest_title, 0)
        self._ledger.credit(user_id, gold)  # quest reward

    def award_streak_bonus(self, user_id, days):
        gold = min(days * 10, 100)
        self._ledger.credit(user_id, gold)  # streak reward

    def celebrate_milestone(self, user_id, days):
        if days % 7 == 0:
            send_push(user_id, f"🎉 {days}-day streak!")
