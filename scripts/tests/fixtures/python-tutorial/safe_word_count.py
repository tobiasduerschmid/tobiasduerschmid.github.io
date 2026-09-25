import sys

# 1. Check sys.argv — error to stderr + exit(1) if no filename
if len(sys.argv) < 2:
    print("Error: no filename given", file=sys.stderr)
    sys.exit(1)

# 2. Print "Reading: <filename>" to stderr
filename = sys.argv[1]
print(f"Reading: {filename}", file=sys.stderr)

# 3. Count words, print "Total words: <count>" to stdout
total = 0
with open(filename) as f:
    for line in f:
        total += len(line.split())

print(f"Total words: {total}")
