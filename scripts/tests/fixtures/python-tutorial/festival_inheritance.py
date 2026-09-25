class StageSet:
    def __init__(self, title):
        self.title = title
        self.cues = []

    def sound(self):
        return "acoustic"

    def prepare(self):
        cue = self.title + ": " + self.sound()
        self.cues.append(cue)
        return cue

    def announce(self):
        self.cues.append("announced")
        return self.title + " is next"


class RehearsalSet(StageSet):
    pass


class BassSet(StageSet):
    def __init__(self, title, level):
        super().__init__(title)
        self.level = level

    def sound(self):
        return super().sound() + " + bass " + str(self.level)


rehearsal = RehearsalSet("Afternoon")
bass = BassSet("Midnight", 4)
print("Inherited initializer:", rehearsal.prepare())
print("Inherited method, overridden sound:", bass.prepare())
print("One instance owns the cues:", bass.cues)
class StreamSet(StageSet):
    def __init__(self, title, platform):
        super().__init__(title)
        self.platform = platform

    def sound(self):
        return "stream"

    def announce(self):
        base_message = super().announce()
        return base_message + " on " + self.platform
