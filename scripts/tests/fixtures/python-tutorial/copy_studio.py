import copy

# Worked example: two slots refer to one inner list.
opening = ["Pulse"]
lineup = [opening, opening]
alias = lineup
shallow = copy.copy(lineup)
deep = copy.deepcopy(lineup)
shallow[0].append("Orbit")
print("Original:", lineup)
print("Alias:", alias)
print("Deep:", deep)
print("Deep keeps shared inner list:", deep[0] is deep[1])


class Mixer:
    def __init__(self, level):
        self.level = level


class Show:
    def __init__(self, title, mixer):
        self.title = title
        self.mixer = mixer
        self.backup = mixer


# Worked example: an ordinary object has another object as a member.
live = Show("Night Stage", Mixer(4))
live_alias = live
rehearsal = copy.copy(live)
archive = copy.deepcopy(live)
rehearsal.mixer.level = 7
rehearsal.title = "Soundcheck"
print("Live:", live.title, live.mixer.level)
print("Alias level:", live_alias.mixer.level)
print("Archive:", archive.title, archive.mixer.level)
def versions(original):
    """Return [the original, a shallow copy, a deep copy]."""
    shared = original
    shallow = copy.copy(original)
    independent = copy.deepcopy(original)
    return [shared, shallow, independent]
