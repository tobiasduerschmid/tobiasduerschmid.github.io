class Playlist:
    def __init__(self, tracks):
        self.tracks = tracks


def rename_locally(title):
    title = "Remix: " + title


def extend_locally(tracks):
    tracks = tracks + ["Finale"]


def append_shared(tracks):
    tracks.append("Finale")


def replace_first(tracks):
    tracks[0] = "Overture"


def replace_playlist(playlist):
    playlist = Playlist(["Finale"])


def edit_member(playlist):
    playlist.tracks.append("Finale")


title = "Pulse"
rename_locally(title)
print("String rebinding:", title)
tracks = ["Pulse"]
extend_locally(tracks)
print("List rebinding:", tracks)
append_shared(tracks)
print("List append:", tracks)
replace_first(tracks)
print("Item replacement:", tracks)
show = Playlist(["Pulse"])
replace_playlist(show)
print("Object rebinding:", show.tracks)
edit_member(show)
print("Member mutation:", show.tracks)
def preview_track(playlist, title):
    """Return an independent Playlist with title added; keep playlist unchanged."""
    return Playlist(playlist.tracks + [title])


def register_guest(name, guests=None):
    """Append to a supplied guest list, or start a fresh one when omitted."""
    if guests is None:
        guests = []
    guests.append(name)
    return guests


print("First guest call:", register_guest("Ari"))
print("Second guest call:", register_guest("Sol"))
