from __future__ import annotations

from datetime import datetime

from croniter import croniter

from app.config import APP_TIMEZONE


def now_in_app_timezone() -> datetime:
    return datetime.now(APP_TIMEZONE)


def validate_schedule(schedule: str) -> None:
    if not croniter.is_valid(schedule):
        raise ValueError("Invalid CRON schedule.")


def get_next_run_at(schedule: str, base_time: datetime | None = None) -> datetime:
    validate_schedule(schedule)
    base = base_time or now_in_app_timezone()
    localized_base = base.astimezone(APP_TIMEZONE)
    iterator = croniter(schedule, localized_base)
    return iterator.get_next(datetime)

