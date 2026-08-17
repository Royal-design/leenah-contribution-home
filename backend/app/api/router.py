from fastapi import APIRouter

from app.api.routes.admin import router as admin_router
from app.api.routes.audit_logs import router as audit_logs_router
from app.api.routes.auth import router as auth_router
from app.api.routes.bank_accounts import router as bank_accounts_router
from app.api.routes.config import router as config_router
from app.api.routes.contributions import router as contributions_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.savings import router as savings_router
from app.api.routes.support import router as support_router
from app.api.routes.transactions import router as transactions_router
from app.api.routes.users import router as users_router
from app.api.routes.wallet import router as wallet_router
from app.api.routes.webhooks import router as webhooks_router
from app.api.routes.withdrawals import router as withdrawals_router

api_router = APIRouter()


def includes_api_routes(api: APIRouter):
    api.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
    api.include_router(users_router, prefix="/api/users", tags=["Users"])
    api.include_router(notifications_router, prefix="/api/notifications", tags=["Notifications"])
    api.include_router(contributions_router, prefix="/api/contributions", tags=["Contributions"])
    api.include_router(savings_router, prefix="/api/savings", tags=["Savings"])
    api.include_router(wallet_router, prefix="/api/wallet", tags=["Wallet"])
    api.include_router(bank_accounts_router, prefix="/api/bank-accounts", tags=["Bank Accounts"])
    api.include_router(transactions_router, prefix="/api/transactions", tags=["Transactions"])
    api.include_router(withdrawals_router, prefix="/api/withdrawals", tags=["Withdrawals"])
    api.include_router(support_router, prefix="/api/support", tags=["Support"])
    api.include_router(admin_router, prefix="/api/admin", tags=["Admin"])
    api.include_router(audit_logs_router, prefix="/api/audit-logs", tags=["Audit Logs"])
    api.include_router(config_router, prefix="/api/config", tags=["Config"])
    api.include_router(webhooks_router, prefix="/webhooks/paystack", tags=["Webhooks"])


includes_api_routes(api_router)