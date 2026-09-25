class GuestPass:
    def __init__(self, label):
        self.label = label


first = GuestPass("Balcony")
second = GuestPass("Balcony")
alias = first
print("Separate passes:", first == second, first is second)
print("Alias:", first == alias, first is alias)
class Recording:
    def __init__(self, title, artist):
        self.title = title
        self.artist = artist
    def __eq__(self, other):
        if not isinstance(other, Recording):
            return NotImplemented
        return self.title == other.title and self.artist == other.artist
