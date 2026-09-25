def running_total(numbers: list[int]) -> list[int]:
    """Return a list of cumulative sums.
    Example: running_total([1, 2, 3]) == [1, 3, 6]
    """
    result = []
    total = 0
    for n in numbers:
        total += n          # add n to the running sum
        result.append(total)  # append the current cumulative total
    return result

# --- Quick self-test ---
data = [4, 8, 15, 16, 23, 42]
print(f"Data:          {data}")
print(f"Running total: {running_total(data)}")

# Verify your understanding of / vs //
print(f"7 / 2  = {7 / 2}")    # 3.5
print(f"7 // 2 = {7 // 2}")   # 3
