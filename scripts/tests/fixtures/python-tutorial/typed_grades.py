from typing import Optional

def mean(numbers: list[float]) -> float:
    return sum(numbers) / len(numbers)

def label_score(score: int, threshold: int = 50) -> str:
    if score >= threshold:
        return 'pass'
    return 'fail'

def first_failing(scores: list[int], threshold: int = 50) -> Optional[int]:
    """Return the first score below threshold, or None if all pass."""
    for s in scores:
        if s < threshold:
            return s
    return None

# --- Quick self-test ---
print(f"Mean:           {mean([4, 8, 15, 16, 23, 42])}")
print(f"Label 75:       {label_score(75)}")
print(f"First failing:  {first_failing([90, 80, 30, 70])}")

# Step 4 probe (left commented — uncommenting crashes the file):
# print(mean(['a', 'b']))
#   → TypeError: unsupported operand type(s) for +: 'int' and 'str'
# The error comes from `sum(numbers)`, not from the annotation.
# Python ran the call; mypy would have flagged it at edit-time.
