from dataclasses import dataclass

class PointManual:
    """The OLD way: hand-written __init__, __eq__, __repr__."""
    def __init__(self, x, y):
        self.x = x
        self.y = y
    def __eq__(self, other):
        return isinstance(other, PointManual) and self.x == other.x and self.y == other.y
    def __repr__(self):
        return f"PointManual(x={self.x}, y={self.y})"

@dataclass(frozen=True)
class Point:
    x: int
    y: int

    @property
    def distance_to_origin(self) -> float:
        return (self.x ** 2 + self.y ** 2) ** 0.5

@dataclass(frozen=True)
class RGB:
    r: int
    g: int
    b: int

    @property
    def as_hex(self) -> str:
        return f'#{self.r:02x}{self.g:02x}{self.b:02x}'

# --- Quick self-test ---
a = Point(3, 4)
b = Point(3, 4)
print(a == b)                # True
print(a)                     # Point(x=3, y=4)
print(a.distance_to_origin)  # 5.0
print(RGB(255, 128, 0).as_hex)  # '#ff8000'
