"""The result every speaker returns for one cue."""
from dataclasses import dataclass
from typing import Optional

import numpy as np

from .transcript import Mismatch


@dataclass
class Speech:
    samples: np.ndarray                # float32 mono at audio.RATE, ready to join
    heard: Optional[str] = None        # transcript of the chosen take, when the engine checks one
    mismatch: Optional[Mismatch] = None  # how far `heard` is from the script

    @property
    def needs_review(self):
        return self.mismatch is not None and self.mismatch.rate > 0
