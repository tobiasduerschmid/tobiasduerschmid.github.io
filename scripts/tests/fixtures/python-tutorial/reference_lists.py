def group_sets(opening, late, encore):
    sets = [opening, late]
    sets.append(encore)
    return sets

def combine_tracks(opening, late, encore):
    tracks = opening + late
    tracks.extend(encore)
    return tracks

opening = ["Lantern"]
late = ["Afterglow", "Lantern"]
encore = ["Homeward"]
print("Grouped:", group_sets(opening, late, encore))
print("Running order:", combine_tracks(opening, late, encore))
