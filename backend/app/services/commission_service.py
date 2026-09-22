from decimal import Decimal, ROUND_DOWN
import uuid

from sqlalchemy.orm import Session

from app.models.contribution import Contribution
from app.models.enums import CommissionType
from app.models.platform_setting import PlatformSetting
from app.models.savings_plan import SavingsPlan
from app.repositories.platform_setting_repository import platform_setting_repository

# Human keys identifying which financial action a commission applies to.
# Stored verbatim in `platform_settings` under "commission_defaults".
WALLET_WITHDRAWAL = "wallet_withdrawal"
SAVINGS_WITHDRAWAL = "savings_withdrawal"
CONTRIBUTION_WITHDRAWAL = "contribution_withdrawal"
CONTRIBUTION_PAYOUT = "contribution_payout"
EMERGENCY_WITHDRAWAL = "emergency_withdrawal"
ADMIN_PAYOUT = "admin_payout"

COMMISSION_KEYS = (
    WALLET_WITHDRAWAL,
    SAVINGS_WITHDRAWAL,
    CONTRIBUTION_WITHDRAWAL,
    CONTRIBUTION_PAYOUT,
    EMERGENCY_WITHDRAWAL,
    ADMIN_PAYOUT,
)

_SETTINGS_KEY = "commission_defaults"

_DEFAULT_CONFIG = {key: {"enabled": False, "type": "percentage", "rate": 0.0, "fixed": 0} for key in COMMISSION_KEYS}


def _entry(enabled: bool, type_: str, rate: float, fixed: int) -> dict:
    return {"enabled": enabled, "type": type_, "rate": rate, "fixed": fixed}


def _decimal(value: float | Decimal | None) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_DOWN)


def compute_commission(*, amount: int, type_: str, rate: float | Decimal | None, fixed: int | None) -> dict:
    """Deterministic integer commission math (naira).

    gross = amount
    commission = floor(gross * rate / 100)  [+ fixed when configured]
    net = gross - commission

    All arithmetic is done with Decimal and truncated to whole naira, so the
    same inputs always produce the same output regardless of float drift.
    """
    gross = int(amount)
    rate_dec = _decimal(rate)
    fixed = int(fixed or 0)

    percentage_part = int((Decimal(gross) * rate_dec / Decimal(100)).to_integral_value(rounding=ROUND_DOWN))

    if type_ == CommissionType.PERCENTAGE.value:
        commission = percentage_part
    elif type_ == CommissionType.FIXED.value:
        commission = fixed
    elif type_ == CommissionType.PERCENTAGE_FIXED.value:
        commission = percentage_part + fixed
    else:
        commission = 0

    commission = min(commission, gross)
    return {
        "rate": rate_dec,
        "type": type_,
        "fixed": fixed,
        "percentage_part": percentage_part,
        "commission": commission,
        "net": gross - commission,
    }


class CommissionService:
    """Resolves and applies the platform's configurable commission model.

    Commission can be configured per transaction type at the platform level,
    and overridden per plan (Savings / Contribution). The result of every
    calculation is stored on the transaction/withdrawal so revenue is always
    auditable from the ledger — never recomputed from frontend data.
    """

    # ------------------------------------------------------------ settings

    def get_defaults(self, db: Session) -> dict:
        setting = platform_setting_repository.get(db, _SETTINGS_KEY)
        value = setting.value if setting is not None else {}
        merged = {key: {**_DEFAULT_CONFIG[key], **(value.get(key) or {})} for key in COMMISSION_KEYS}
        return merged

    def set_defaults(self, db: Session, payload: dict, *, actor_id: uuid.UUID | None = None) -> dict:
        normalized = {}
        for key in COMMISSION_KEYS:
            entry = payload.get(key)
            if entry is None:
                continue
            normalized[key] = {
                "enabled": bool(entry.get("enabled", False)),
                "type": entry.get("type", "percentage"),
                "rate": float(entry.get("rate") or 0),
                "fixed": int(entry.get("fixed") or 0),
            }
        platform_setting_repository.set_value(db, _SETTINGS_KEY, normalized, actor_id=actor_id)
        db.flush()
        return normalized

    # ---------------------------------------------------------- resolution

    def resolve(
        self,
        db: Session,
        *,
        key: str,
        amount: int,
        plan: SavingsPlan | None = None,
        contribution: Contribution | None = None,
    ) -> dict:
        """Resolve the effective commission config for an action+amount.

        Priority:
          1. An explicit per-plan override (plan.commission_enabled).
          2. The platform default configurability entry for `key`.

        Returns the frozen commission breakdown (rate/type/commission/net).
        When no commission applies `enabled` is False and net == amount.
        """
        if amount <= 0:
            return {"enabled": False, "rate": None, "type": None, "fixed": 0, "commission": 0, "net": 0}

        plan_override = None
        if plan is not None and getattr(plan, "commission_enabled", False):
            plan_override = plan
        elif contribution is not None and getattr(contribution, "commission_enabled", False):
            plan_override = contribution

        if plan_override is not None:
            type_ = plan_override.commission_type or "percentage"
            rate = plan_override.commission_rate
            fixed = plan_override.commission_fixed
            breakdown = compute_commission(amount=amount, type_=type_, rate=rate, fixed=fixed)
            breakdown["enabled"] = True
            return breakdown

        defaults = self.get_defaults(db)
        entry = defaults.get(key, _DEFAULT_CONFIG[key])
        if not entry.get("enabled"):
            return {"enabled": False, "rate": None, "type": None, "fixed": 0, "commission": 0, "net": amount}

        breakdown = compute_commission(
            amount=amount,
            type_=entry.get("type", "percentage"),
            rate=entry.get("rate"),
            fixed=entry.get("fixed"),
        )
        breakdown["enabled"] = True
        return breakdown

    # ------------------------------------------------------------ settings

    def get_settings_dto(self, db: Session) -> dict:
        defaults = self.get_defaults(db)
        return {
            "defaults": defaults,
            "keys": list(COMMISSION_KEYS),
        }


commission_service = CommissionService()