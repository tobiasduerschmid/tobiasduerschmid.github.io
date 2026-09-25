import re

with open("log.txt") as f:
    text = f.read()

# 1. Extract all timestamps (HH:MM:SS) and print count
timestamps = re.findall(r'\d{2}:\d{2}:\d{2}', text)
print(f"Timestamps found: {len(timestamps)}")

# 2. Extract all ERROR lines and print count
errors = re.findall(r'ERROR.*', text)
print(f"Errors: {len(errors)}")

# 3. Redact IPv4 addresses and print redacted log
redacted = re.sub(r'\d+\.\d+\.\d+\.\d+', 'x.x.x.x', text)
print(redacted)
