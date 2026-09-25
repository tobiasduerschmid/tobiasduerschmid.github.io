initial_title = "Harbor Beats"
title = initial_title
poster_title = title
title += " — Live"

initial_capacity = 320
capacity = initial_capacity
printed_capacity = capacity
capacity += 40

featured_track = None
uses_fallback = featured_track is None

print("Poster:", poster_title, printed_capacity)
print("Live:", title, capacity)
print("Use fallback:", uses_fallback)
