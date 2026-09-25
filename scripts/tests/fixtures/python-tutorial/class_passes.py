class BackstagePass:
    created = 0
    access = "general"

    def __init__(self, holder):
        self.holder = holder
        BackstagePass.created += 1
        self.serial = BackstagePass.created
        self.notes = []

    def add_note(self, note):
        self.notes.append(note)

PassMaker = BackstagePass
print("Factory aliases the class:", PassMaker is BackstagePass)
print("The class is an instance of type:", type(BackstagePass) is type)
