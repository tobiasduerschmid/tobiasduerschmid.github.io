---
title: "Test Doubles — Sample Solutions"
layout: sebook
---

# Test Doubles: Stubs, Spies & Mocks — Sample Solutions

These are reference solutions for each exercise in the interactive tutorial.
Each solution explains **why** it is correct, connecting the code back to
the concepts taught in that step.

---

## Step 1: The Dependency Problem — `test_report.py`

```python
# database:
#   Direction: indirect input (the SUT reads sales data from it)
#   Why unreliable: A real database requires setup, is slow to query,
#   and may return different data depending on when the test runs.

# email_sender:
#   Direction: indirect output (the SUT sends an email through it)
#   Why unreliable: A real email sender would send actual emails during
#   testing, which is a side effect. It may also fail if the mail server
#   is down, making the test flaky.

# logger:
#   Direction: indirect output (the SUT writes log messages to it)
#   Why unreliable: A real logger writes to files or external services,
#   creating side effects. In tests, we want to verify WHAT was logged
#   without the overhead of actual file I/O.
```

**Why this is correct:** The database provides data *to* the SUT (indirect input), while the email sender and logger receive actions *from* the SUT (indirect outputs). This distinction is foundational: stubs control indirect inputs, spies observe indirect outputs.

---

## Step 2: Test Stubs — `test_weather_stub.py`

```python
class StubWeatherService:
    def __init__(self, temperature):
        self.temperature = temperature

    def get_temperature(self, city):
        return self.temperature


def test_hot_day():
    stub = StubWeatherService(temperature=35)
    reporter = WeatherReporter(stub)
    assert reporter.daily_summary("LA") == "Hot day ahead!"

def test_pleasant_day():
    stub = StubWeatherService(temperature=22)
    reporter = WeatherReporter(stub)
    assert reporter.daily_summary("NYC") == "Pleasant weather."

def test_cold_day():
    stub = StubWeatherService(temperature=5)
    reporter = WeatherReporter(stub)
    assert reporter.daily_summary("Chicago") == "Bundle up, it's cold!"
```

**Why this is correct:** Each test creates a stub with a specific temperature, injects it into the SUT, and asserts on the SUT's return value. This is **state verification** — we check what the function returns, not how it called the stub. The city argument is irrelevant to the stub (it always returns the configured temperature), which is fine — the stub exists to control the input, not to simulate the full API.

---

## Step 3: Test Spies — `test_order_spy.py`

```python
class SpyLogger:
    def __init__(self):
        self.messages = []

    def log(self, message):
        self.messages.append(message)


def test_logs_order_placed():
    spy = SpyLogger()
    processor = OrderProcessor(spy)
    processor.process(42, 29.99)
    assert len(spy.messages) == 1
    assert spy.messages[0] == "Order 42 placed"

def test_logs_multiple_orders():
    spy = SpyLogger()
    processor = OrderProcessor(spy)
    processor.process(1, 10.0)
    processor.process(2, 20.0)
    assert len(spy.messages) == 2
```

**Why this is correct:** The spy records every `log()` call. After exercising the SUT, we assert on the recorded messages. This is **procedural behavior verification** — the assertions are explicit in the test method, making them easy to read and debug.

---

## Step 4: Mock vs Spy — `test_mock_vs_spy.py`

```python
def test_register_sends_email_spy():
    spy = SpyEmailSender()
    service = UserService(email_sender=spy)
    service.register("alice@example.com")
    assert len(spy.sent_emails) == 1
    assert spy.sent_emails[0]["to"] == "alice@example.com"
    assert "Welcome" in spy.sent_emails[0]["subject"]

def test_register_sends_email_mock():
    mock = MockEmailSender(
        expected_to="alice@example.com",
        expected_subject_contains="Welcome"
    )
    service = UserService(email_sender=mock)
    service.register("alice@example.com")
    mock.verify()

# REFLECTION: The spy version is more maintainable.
# If the subject changed from "Welcome!" to "Welcome aboard!",
# the spy test would still pass (it checks "Welcome" in subject),
# while the mock would need its expectation updated.
```

---

## Step 5: unittest.mock — `test_framework.py`

```python
from unittest.mock import MagicMock

def test_hot_day_with_mock():
    mock_service = MagicMock()
    mock_service.get_temperature.return_value = 35
    reporter = WeatherReporter(mock_service)
    assert reporter.daily_summary("LA") == "Hot day ahead!"
    mock_service.get_temperature.assert_called_once_with("LA")

def test_order_logged_with_mock():
    mock_logger = MagicMock()
    processor = OrderProcessor(mock_logger)
    processor.process(42, 29.99)
    mock_logger.log.assert_called_once_with("Order 42 placed")
```

**Why this is correct:** `MagicMock` replaces our manual stubs and spies. `return_value` provides stub behavior; `assert_called_once_with` provides spy/mock verification. The framework eliminates boilerplate while doing exactly what our manual classes did.

---

## Step 6: @patch — `test_daily_report.py`

```python
from unittest.mock import patch, MagicMock
from datetime import datetime

@patch('daily_report.datetime')
def test_report_uses_todays_date(mock_dt):
    mock_dt.now.return_value = datetime(2024, 6, 15)
    result = generate_report()
    assert "2024-06-15" in result

@patch('builtins.open', side_effect=FileNotFoundError("no such file"))
def test_config_file_not_found(mock_open):
    result = read_config("missing.txt")
    assert result == "default-config"

def test_prices_with_side_effect():
    mock_api = MagicMock()
    mock_api.get_price.side_effect = [150.0, 280.0]
    result = fetch_prices(mock_api, ["AAPL", "MSFT"])
    assert result == {"AAPL": 150.0, "MSFT": 280.0}
```

**Why this is correct:** The `@patch` decorator patches `datetime` where it's **looked up** (`daily_report.datetime`), not where it's defined. `side_effect` with a list returns different values on successive calls — perfect for the multi-symbol price fetch.

---

## Step 7: Over-Mocking Audit — `test_invoice_audit.py`

| Test | Verdict | Why |
|------|---------|-----|
| Test 1 (successful_payment) | **Appropriate** | Mocks the payment gateway — a real external boundary |
| Test 2 (tax_calculation) | **Over-mocked** | `_calculate_tax` is an internal pure function — test it directly |
| Test 3 (sends_receipt_email) | **Appropriate** | Mocks the email sender — a real external boundary |
| Test 4 (format_currency) | **Over-mocked** | `_format_currency` is an internal pure function — no mock needed |
| Test 5 (payment_failure) | **Appropriate** | Mocks the gateway to simulate failure — testing an error path |
| Test 6 (exact_call_order) | **Over-mocked** | Verifying exact method call order tests implementation, not behavior |

---

## Step 8: Capstone — `test_github.py`

```python
from unittest.mock import MagicMock
from github_client import GitHubClient

# STRATEGY: Mock http_client (external HTTP boundary) and logger (I/O boundary).
# The GitHubClient's internal logic (list comprehension, retry loop) is tested
# with real code — no mocking of internals.

def test_list_repos():
    mock_http = MagicMock()
    mock_http.get.return_value = {
        "status": 200,
        "data": [{"name": "repo-a"}, {"name": "repo-b"}]
    }
    mock_logger = MagicMock()
    client = GitHubClient(mock_http, mock_logger)
    repos = client.list_repos("alice")
    assert repos == ["repo-a", "repo-b"]

def test_create_issue():
    mock_http = MagicMock()
    mock_http.post.return_value = {"status": 201, "data": {"id": 1}}
    mock_logger = MagicMock()
    client = GitHubClient(mock_http, mock_logger)
    result = client.create_issue("my-repo", "Bug", "Something broke")
    mock_http.post.assert_called_once_with(
        "/repos/my-repo/issues",
        data={"title": "Bug", "body": "Something broke"}
    )

def test_retry_on_failure():
    mock_http = MagicMock()
    mock_http.get.side_effect = [
        Exception("timeout"),
        Exception("timeout"),
        {"status": 200, "data": "success"}
    ]
    mock_logger = MagicMock()
    client = GitHubClient(mock_http, mock_logger)
    result = client.fetch_with_retry("/test", max_retries=3)
    assert result == "success"

def test_logs_api_calls():
    mock_http = MagicMock()
    mock_http.get.return_value = {"status": 200, "data": []}
    mock_logger = MagicMock()
    client = GitHubClient(mock_http, mock_logger)
    client.list_repos("alice")
    mock_logger.log.assert_called()

def test_api_error_handling():
    mock_http = MagicMock()
    mock_http.get.return_value = {"status": 500}
    mock_logger = MagicMock()
    client = GitHubClient(mock_http, mock_logger)
    with pytest.raises(ConnectionError):
        client.list_repos("alice")
```
