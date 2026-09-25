class Artist:
    def __init__(self, name):
        self.name = name

    def rename(self, new_name):
        self.name = new_name

class Playlist:
    def __init__(self, name, artist):
        self.name = name
        self.artist = artist
        self.tracks = []

    def add_track(self, track):
        self.tracks.append(track)

    def rename(self, new_name):
        self.name = new_name

artist = Artist("Silver Current")
first = Playlist("Afternoon", artist)
second = Playlist("Afterparty", artist)
first.add_track("Open Water")
first.rename("Afternoon Live")
print("Shared artist:", first.artist is second.artist is artist)
print("Playlists:", first.name, second.name)
print("Queues:", first.tracks, second.tracks)
