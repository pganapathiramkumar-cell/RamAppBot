"""Value Object: AlignmentScore — immutable, self-validating."""

from dataclasses import dataclass


@dataclass(frozen=True)
class AlignmentScore:
    value: float

    def __post_init__(self):
        if not 0.0 <= self.value <= 1.0:
            raise ValueError(f"AlignmentScore must be 0.0–1.0, got {self.value}")

    @property
    def percentage(self) -> int:
        return round(self.value * 100)

    @property
    def label(self) -> str:
        if self.value >= 0.8:
            return "Excellent"
        if self.value >= 0.6:
            return "Good"
        if self.value >= 0.4:
            return "Fair"
        return "Poor"

    def __str__(self) -> str:
        return f"{self.percentage}% ({self.label})"
