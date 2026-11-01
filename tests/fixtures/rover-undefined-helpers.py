def navigate(commands):
    x, y, heading = 0, 0, "N"
    for command in commands:
        if command == "F":
            x, y = next_position(x, y, heading)
        elif command == "L":
            heading = turn_heading(heading, "L")
        elif command == "R":
            heading = turn_heading(heading, "R")
        elif command == "X":
            x, y, heading = reset_session()
        elif command == "U":
            x, y, heading = undo_action()
    return (x, y, heading)
