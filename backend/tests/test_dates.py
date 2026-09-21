"""Tests for calendar-aware duration/date logic (no DB required).

Covers month lengths, leap years, month-end clamping, year boundaries and
the preset expectations used across plan creation.
"""

from datetime import datetime

import pytest

from app.utils.dates import add_months, end_date_from_duration, period_count, period_dates


def _dt(year: int, month: int, day: int) -> datetime:
    return datetime(year, month, day)


@pytest.mark.parametrize(
    ("start", "months", "expected"),
    [
        # Simple same-day additions
        (_dt(2027, 1, 15), 1, _dt(2027, 2, 15)),
        (_dt(2027, 1, 15), 3, _dt(2027, 4, 15)),
        (_dt(2027, 1, 15), 6, _dt(2027, 7, 15)),
        (_dt(2027, 1, 15), 12, _dt(2028, 1, 15)),
        # January -> February
        (_dt(2027, 1, 10), 1, _dt(2027, 2, 10)),
        # February -> March
        (_dt(2027, 2, 10), 1, _dt(2027, 3, 10)),
        # December -> January (year boundary)
        (_dt(2027, 12, 15), 1, _dt(2028, 1, 15)),
        (_dt(2027, 12, 31), 1, _dt(2028, 1, 31)),
        # Leap-year February
        (_dt(2024, 1, 31), 1, _dt(2024, 2, 29)),
        (_dt(2024, 2, 29), 1, _dt(2024, 3, 29)),
        (_dt(2024, 2, 29), 12, _dt(2025, 2, 28)),  # Feb 2025 is not a leap year
        # Non-leap February clamping
        (_dt(2023, 1, 31), 1, _dt(2023, 2, 28)),
        # Month-end clamping
        (_dt(2024, 1, 31), 2, _dt(2024, 3, 31)),
        (_dt(2026, 3, 31), 1, _dt(2026, 4, 30)),
        (_dt(2026, 4, 30), 1, _dt(2026, 5, 30)),
        (_dt(2026, 8, 31), 1, _dt(2026, 9, 30)),
        (_dt(2026, 5, 31), 6, _dt(2026, 11, 30)),
        # Custom duration
        (_dt(2027, 1, 15), 9, _dt(2027, 10, 15)),
        (_dt(2027, 1, 15), 240, _dt(2047, 1, 15)),
    ],
)
def test_add_months(start, months, expected):
    assert add_months(start, months) == expected


def test_add_months_rejects_negative():
    with pytest.raises(ValueError):
        add_months(_dt(2027, 1, 15), -1)


@pytest.mark.parametrize(
    ("start", "months", "expected"),
    [
        (datetime(2027, 1, 15), 1, datetime(2027, 2, 15)),
        (datetime(2027, 1, 15), 3, datetime(2027, 4, 15)),
        (datetime(2027, 1, 15), 6, datetime(2027, 7, 15)),
        (datetime(2027, 1, 15), 12, datetime(2028, 1, 15)),
        # Contribution-style example: Oct 1 + 12 calendar months lands on Oct 1.
        (datetime(2026, 10, 1), 12, datetime(2027, 10, 1)),
        # Dec -> Jan across the year boundary
        (datetime(2026, 12, 1), 1, datetime(2027, 1, 1)),
        # Month-end: Jan 31 + 3 months on a leap year = Apr 30
        (datetime(2024, 1, 31), 3, datetime(2024, 4, 30)),
    ],
)
def test_end_date_from_duration(start, months, expected):
    assert end_date_from_duration(start, months) == expected


def test_period_count_monthly():
    start = _dt(2027, 1, 15)
    assert period_count(start, _dt(2027, 2, 15), "monthly") == 1
    assert period_count(start, _dt(2027, 4, 15), "monthly") == 3
    assert period_count(start, _dt(2028, 1, 15), "monthly") == 12
    assert period_count(_dt(2026, 10, 1), _dt(2027, 10, 1), "monthly") == 12


def test_period_count_weekly_and_biweekly():
    start = _dt(2027, 1, 1)
    # Due dates inside the [start, end) window.
    assert period_count(start, _dt(2027, 1, 22), "weekly") == 3
    assert period_count(start, _dt(2027, 1, 1 + 14), "biweekly") == 1
    assert period_count(_dt(2027, 1, 1), _dt(2027, 1, 1 + 28), "biweekly") == 2


def test_period_dates_month_end_safety():
    # Step-by-step clamping preserves the previous step's day (Mar 29, not Mar 31).
    dates = period_dates(_dt(2024, 1, 31), "monthly", 3)
    assert dates == [_dt(2024, 1, 31), _dt(2024, 2, 29), _dt(2024, 3, 29)]


def test_period_dates_weekly():
    dates = period_dates(_dt(2027, 1, 1), "weekly", 2)
    assert dates == [_dt(2027, 1, 1), _dt(2027, 1, 8)]