from functions import mean

def above_average(numbers: list[float]) -> list[float]:
    """Return a list of numbers strictly greater than the mean."""
    avg = mean(numbers)
    return [x for x in numbers if x > avg]

def squares_up_to(n: int) -> list[int]:
    """Return [1**2, 2**2, ..., n**2] using range() and **."""
    return [x**2 for x in range(1, n + 1)]

# --- Quick self-test ---
data = [4, 8, 15, 16, 23, 42]
print(f"Data:          {data}")
print(f"Above average: {above_average(data)}")
print(f"Squares to 5:  {squares_up_to(5)}")
