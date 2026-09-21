"""Calendar-aware date arithmetic used by plan creation and scheduling.

These helpers are the single source of truth for duration -> end-date and
period stepping. They intentionally avoid naive day-counting (e.g. 12 months
!= 365 days) and handle month-end dates, leap years and year boundaries.

Conventions
-----------
- A plan's *duration* is expressed in whole calendar months.
- ``end_date = add_months(start_date, duration)`` — e.g. a 3-month plan from
  Jan 15 ends Apr 15; a 12-month plan from Oct 1 ends Oct 1 the next year.
- The number of scheduled periods is the count of due dates inside the
  ``[start, end)`` window, so a 3-month monthly plan makes 3 payments.
- ``payout_date_at`` converts a rotational *position* into a withdrawal date:
  weekly/biweekly step from the start; monthly/custom plans pay at the end of
  the position's calendar month.
"""

from datetime import datetime, timedelta, timezone
import calendar


def add_months(base: datetime, months: int) -> datetime:
    """Add whole calendar months to ``base``, clamping to the month's last day.

    Example: Jan 31 + 1mo -> Feb 28 (or Feb 29 on a leap year).
    """
    if months < 0:
        raise ValueError("months must be >= 0")
    year = base.year + (base.month - 1 + months) // 12
    month = (base.month - 1 + months) % 12 + 1
    day = min(base.day, calendar.monthrange(year, month)[1])
    return base.replace(year=year, month=month, day=day)


def end_date_from_duration(start: datetime, duration_months: int) -> datetime:
    """End date of a plan that starts on ``start`` and lasts ``duration_months``."""
    return add_months(start, duration_months)


def period_count(start: datetime, end: datetime, frequency: str) -> int:
    """Number of due dates that fall inside the ``[start, end)`` window."""
    if end < start:
        return 0

    if frequency == "weekly":
        return _step_count(start, end, 7)
    if frequency == "biweekly":
        return _step_count(start, end, 14)

    # monthly / custom: one due date per calendar month
    months = (end.year - start.year) * 12 + (end.month - start.month)
    return max(months, 1)


def period_dates(start: datetime, frequency: str, periods: int) -> list[datetime]:
    """Return ``periods`` due dates beginning at ``start``."""
    if periods < 1:
        return []

    dates: list[datetime] = []
    current = start
    for _ in range(periods):
        dates.append(current)
        if frequency == "weekly":
            current = _add_days(current, 7)
        elif frequency == "biweekly":
            current = _add_days(current, 14)
        else:
            current = add_months(current, 1)
    return dates


def payout_date_at(start: datetime, frequency: str, position: int) -> datetime:
    """Withdrawal date for the member holding rotational ``position``.

    Position 1 withdraws in the plan's first period. Weekly/biweekly use fixed
    7/14-day steps from the start date. Monthly/custom plans withdraw at the
    *end of each calendar month* (leap-year and month-end safe): position 2 in
    a plan started in January pays out on the last day of February, etc.
    """
    step_days = {"weekly": 7, "biweekly": 14}
    if frequency in step_days:
        return _add_days(start, step_days[frequency] * max(position - 1, 0))

    months_after = max(position - 1, 0)
    year = start.year + (start.month - 1 + months_after) // 12
    month = (start.month - 1 + months_after) % 12 + 1
    last_day = calendar.monthrange(year, month)[1]
    return start.replace(year=year, month=month, day=last_day)


def _step_count(start: datetime, end: datetime, days: int) -> int:
    """Number of 7/14-day due dates strictly inside ``[start, end)``."""
    diff = end - start
    total_days = diff.days + (1 if diff.seconds else 0)
    if total_days <= 0:
        return 1  # degenerate window — the start period still counts
    return total_days // days + (1 if total_days % days else 0)


def _add_days(dt: datetime, days: int) -> datetime:
    from datetime import timedelta

    return dt + timedelta(days=days)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def start_date_in_past(start: datetime) -> bool:
    """True when ``start``'s calendar date is before today (UTC).

    Used to reject plans created with a start date in the past and to prevent
    users from self-joining plans that have already begun.
    """
    return start.date() < datetime.now(timezone.utc).date()


def start_date_change_forbidden(start: datetime, current: datetime | None = None) -> bool:
    """True when moving a plan's start date into the past.

    Keeping the same calendar date as ``current`` is still allowed, so an
    already-started plan can keep being edited without being forced to change
    its (legacy) start date.
    """
    if not start_date_in_past(start):
        return False
    if current is not None and start.date() == current.date():
        return False
    return True