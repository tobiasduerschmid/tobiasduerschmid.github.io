# SUB-GOAL: Initialize the counter
total = 0

# SUB-GOAL: Open and read the file
with open("data.txt") as f:
    for line in f:
        words = line.split()
        # SUB-GOAL: Accumulate the count
        total += len(words)

# SUB-GOAL: Report the result
print(f"Total words: {total}")
