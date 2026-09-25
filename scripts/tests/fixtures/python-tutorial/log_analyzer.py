import sys
import re

def count_by_level(text: str, level: str) -> int:
    """Return the number of lines matching the given log level."""
    return len(re.findall(rf'{level}.*', text))

def extract_ips(text: str) -> set[str]:
    """Return all unique IP addresses found in text."""
    return set(re.findall(r'\d+\.\d+\.\d+\.\d+', text))

def parse_args() -> str:
    """Validate and return the filename argument."""
    if len(sys.argv) < 2:
        print("Error: no filename given", file=sys.stderr)
        sys.exit(1)
    return sys.argv[1]

def read_log(filename: str) -> str:
    """Read and return the full log file as a string."""
    print(f"Reading: {filename}", file=sys.stderr)
    with open(filename) as f:
        return f.read()

def print_report(text: str) -> None:
    """Print the analysis report to stdout."""
    lines = text.splitlines()
    total = len(lines)
    unique_ips = len(extract_ips(text))
    errors = count_by_level(text, 'ERROR')
    warnings = count_by_level(text, 'WARNING')

    print("Log Analysis Report")
    print("===================")
    print(f"Total lines:    {total}")
    print(f"Unique IPs:     {unique_ips}")
    print(f"Errors:         {errors}")
    print(f"Warnings:       {warnings}")

# Main flow
filename = parse_args()
text = read_log(filename)
print_report(text)
