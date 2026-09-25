def mean(numbers):
    """Return the arithmetic mean of a list of numbers."""
    return sum(numbers) / len(numbers)

def label_score(score, threshold=50):
    """Return 'pass' if score >= threshold, else 'fail'."""
    if score >= threshold:
        return 'pass'
    else:
        return 'fail'

# --- Quick self-test ---
data = [4, 8, 15, 16, 23, 42]
print(f"Data: {data}")
print(f"Mean: {mean(data)}")
print(f"Score 75: {label_score(75)}")
print(f"Score 30: {label_score(30)}")
print(f"Score 75 (threshold=80): {label_score(75, 80)}")
