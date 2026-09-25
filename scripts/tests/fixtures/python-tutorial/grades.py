# Fixer Upper: both bugs fixed
scores = [95, 83, 71, 62, 55]

for score in scores:
    if score >= 90:
        print(f"Score {score}: A")    # Bug 1 fixed: indented 8 spaces
    elif score >= 80:
        print(f"Score {score}: B")    # Bug 2 fixed: f-string instead of + concatenation
    elif score >= 60:
        print(f"Score {score}: C")
    else:
        print(f"Score {score}: F")
