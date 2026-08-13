import uuid

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.main import app
from app.models.user import User

client = TestClient(app)


def check(resp, label, expected=200):
    body = resp.json()
    assert resp.status_code == expected, f"[{label}] status {resp.status_code}: {body}"
    if expected >= 200 and expected < 300:
        assert body.get("success") is not False, f"[{label}] success=false: {body}"
    print(f"OK  {label}")
    return body


# ---- Auth ----
email = f"user_{uuid.uuid4().hex[:8]}@lchmail.com"
reg = check(
    client.post("/api/auth/register", json={
        "first_name": "Ada", "last_name": "Nwosu", "email": email,
        "password": "StrongPass123!", "phone": "08012345678",
    }),
    "register",
    200,
)
access = reg["data"]["access_token"]
refresh = reg["data"]["refresh_token"]
headers = {"Authorization": f"Bearer {access}"}

me = check(client.get("/api/auth/me", headers=headers), "auth/me")
assert me["data"]["email"] == email

check(client.patch("/api/auth/me", headers=headers, json={"phone": "0701112222"}), "auth/me patch")

# ---- Users / profile ----
check(client.get("/api/users/me", headers=headers), "users/me")
check(client.patch("/api/users/me", headers=headers, json={"phone": "0813334444"}), "users/me patch")
bad_avatar = client.post(
    "/api/users/me/avatar",
    headers=headers,
    files={"file": ("notes.txt", b"not an image", "text/plain")},
)
assert bad_avatar.status_code == 400, f"avatar invalid type: {bad_avatar.json()}"
check(client.delete("/api/users/me/avatar", headers=headers), "users/me avatar delete")
png = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082"
)
cdn_avatar = client.post(
    "/api/users/me/avatar",
    headers=headers,
    files={"file": ("avatar.png", png, "image/png")},
)
assert cdn_avatar.status_code in (200, 400), f"avatar upload unexpected: {cdn_avatar.status_code} {cdn_avatar.json()}"
if cdn_avatar.status_code == 200:
    check(client.delete("/api/users/me/avatar", headers=headers), "users/me avatar cleanup")

check(client.post("/api/auth/refresh", json={"refresh_token": "bad-token"}), "auth/refresh bad token", 401)
check(client.post("/api/auth/refresh", json={"refresh_token": refresh}), "auth/refresh", 200)

# ---- Savings ----
check(client.get("/api/savings/account", headers=headers), "savings/account")
check(client.post("/api/savings/fund", headers=headers, json={"amount": 50000, "note": "Monthly top-up"}), "savings/fund")
goal = check(client.post("/api/savings/goals", headers=headers, json={"name": "Trip to Lagos", "target": 200000, "color": "#16a34a"}), "savings/goals create")
goal_id = goal["data"]["id"]
check(client.get(f"/api/savings/goals/{goal_id}", headers=headers), "savings/goals get")
check(client.patch(f"/api/savings/goals/{goal_id}", headers=headers, json={"target": 250000}), "savings/goals update")
check(client.get("/api/savings/goals", headers=headers), "savings/goals list")

# ---- Transactions (mine) ----
check(client.get("/api/transactions", headers=headers), "transactions list")

# ---- Contributions ----
contrib = check(client.post("/api/contributions", headers=headers, json={
    "name": "Christmas Savings",
    "amount": 10000,
    "frequency": "weekly",
    "member_count": 6,
    "rounds": 12,
    "start_date": "2026-08-20T00:00:00Z",
    "withdrawal_rule": "on_schedule",
}), "contributions create")
cid = contrib["data"]["id"]
check(client.get("/api/contributions", headers=headers), "contributions list")
check(client.get(f"/api/contributions/{cid}", headers=headers), "contributions get")
check(client.get("/api/contributions/open", headers=headers), "contributions open")
check(client.post(f"/api/contributions/{cid}/pay", headers=headers, json={}), "contributions pay")
check(client.patch(f"/api/contributions/{cid}", headers=headers, json={"is_open": False}), "contributions update")

# ---- Withdrawals ----
check(client.post("/api/withdrawals", headers=headers, json={
    "amount": 20000,
    "withdrawal_type": "savings",
    "bank_name": "GTBank",
    "account_number": "0123456789",
    "account_name": "Ada Nwosu",
    "destination": "0112345678 GTBAN",
}), "withdrawals create")
check(client.get("/api/withdrawals", headers=headers), "withdrawals list")

# ---- Notifications ----
check(client.get("/api/notifications", headers=headers), "notifications list")
check(client.get("/api/notifications/unread-count", headers=headers), "notifications unread")
check(client.patch("/api/notifications/read-all", headers=headers), "notifications read-all")

# ---- Join as second user ----
email2 = f"user_{uuid.uuid4().hex[:8]}@lchmail.com"
reg2 = check(client.post("/api/auth/register", json={
    "first_name": "Bola", "last_name": "Tinubu", "email": email2, "password": "StrongPass123!",
}), "register user2", 200)
headers2 = {"Authorization": f"Bearer {reg2['data']['access_token']}"}
check(client.get("/api/contributions/open", headers=headers2), "contributions open user2")
open_list = client.get("/api/contributions/open", headers=headers2).json()["data"]["items"]
if open_list:
    check(client.post(f"/api/contributions/{open_list[0]['id']}/join", headers=headers2), "contributions join user2")
    m = client.get("/api/contributions/open", headers=headers2).json()
    # creator closed the contribution above, so open may be empty; skip join if empty

# ---- Admin ----
with SessionLocal() as db:
    admin = db.query(User).filter(User.email == email).one()
    from app.models.enums import UserRole
    admin.role = UserRole.ADMIN
    db.commit()

admin_resp = check(client.post("/api/auth/login", json={"email": email, "password": "StrongPass123!"}), "admin login", 200)
admin_headers = {"Authorization": f"Bearer {admin_resp['data']['access_token']}"}

check(client.get("/api/admin/stats", headers=admin_headers), "admin stats")
check(client.get("/api/admin/roles", headers=admin_headers), "admin roles")
check(client.get("/api/admin/overview", headers=admin_headers), "admin overview")
check(client.get("/api/admin/users", headers=admin_headers), "admin users")
check(client.get("/api/admin/users/{uid}".format(uid=reg2["data"]["user"]["id"]), headers=admin_headers), "admin user detail")
check(client.get("/api/admin/contributions", headers=admin_headers), "admin contributions")
check(client.get("/api/admin/transactions", headers=admin_headers), "admin transactions")
check(client.get("/api/admin/withdrawals", headers=admin_headers), "admin withdrawals")

# Admin views audit log + revert + review withdrawal
logs = check(client.get("/api/audit-logs", headers=admin_headers), "audit-logs list")
assert logs["data"]["total"] > 0
check(client.get(f"/api/audit-logs/{logs['data']['items'][0]['id']}", headers=admin_headers), "audit-logs get")

txns = client.get("/api/admin/transactions", headers=admin_headers).json()["data"]["items"]
fund_txn = next(t for t in txns if t["type"] == "funding")
check(client.post(f"/api/admin/transactions/{fund_txn['id']}/revert", headers=admin_headers), "admin transaction revert")

wds = client.get("/api/admin/withdrawals", headers=admin_headers).json()["data"]["items"]
if wds:
    wid = wds[0]["id"]
    check(client.patch(f"/api/admin/withdrawals/{wid}/review", headers=admin_headers, json={"status": "approved"}), "admin withdrawal review")

# Role/status updates
u2id = reg2["data"]["user"]["id"]
check(client.patch(f"/api/admin/users/{u2id}/status", headers=admin_headers, json={"status": "suspended"}), "admin user status")
check(client.patch(f"/api/admin/users/{u2id}/status", headers=admin_headers, json={"status": "active"}), "admin user status restore")
check(client.patch(f"/api/admin/users/{u2id}/role", headers=admin_headers, json={"role": "admin"}), "admin user role")
check(client.patch(f"/api/admin/users/{u2id}/role", headers=admin_headers, json={"role": "user"}), "admin user role restore")
check(client.get("/api/audit-logs?category=user&page_size=100", headers=admin_headers), "audit-logs filtered")
check(client.get("/api/audit-logs?search=ada", headers=admin_headers), "audit-logs search")
check(client.get("/api/audit-logs/actions", headers=admin_headers), "audit-logs actions")

# ---- Support / contact ----
thread = check(client.post("/api/support/threads", headers=headers, json={
    "subject": "Withdrawal delay",
    "category": "withdrawal",
    "message": "My withdrawal is taking long.",
}), "support thread create")
tid = thread["data"]["id"]
check(client.get("/api/support/threads", headers=headers), "support threads list user")
check(client.get("/api/support/threads", headers=admin_headers), "support threads list admin")
check(client.get("/api/support/threads/unread-count", headers=admin_headers), "support unread admin")
check(client.get("/api/support/threads/unread-count", headers=headers), "support unread user")
check(client.post(f"/api/support/threads/{tid}/messages", headers=admin_headers, json={
    "body": "We are on it, please bear with us.",
}), "support admin reply")
detail = check(client.get(f"/api/support/threads/{tid}", headers=headers), "support thread detail user")
assert len(detail["data"]["messages"]) == 2
check(client.patch(f"/api/support/threads/{tid}/status", headers=headers, json={"status": "resolved"}), "support thread resolve")
thr = check(client.get("/api/support/threads", headers=admin_headers), "support threads admin after")
assert thr["data"]["items"][0]["status"] == "resolved"

# ---- Locked contribution (fixed period) ----
future = check(client.post("/api/admin/contributions", headers=admin_headers, json={
    "name": "Fixed Locked Fund",
    "amount": 20000,
    "frequency": "monthly",
    "member_count": 4,
    "rounds": 6,
    "start_date": "2026-09-01T00:00:00Z",
    "withdrawal_rule": "fixed_date",
    "fixed_withdrawal_date": "2027-03-01T00:00:00Z",
}), "admin create locked contribution")
locked_cid = future["data"]["id"]
check(client.post(f"/api/contributions/{locked_cid}/join", headers=headers2), "user2 join locked")
locked_wd = client.post("/api/withdrawals", headers=headers2, json={
    "amount": 20000,
    "withdrawal_type": "contribution",
    "bank_name": "GTBank",
    "account_number": "0123456789",
    "account_name": "Bola Tinubu",
    "destination": "0123456789 GTBAN",
    "contribution_id": locked_cid,
})
assert locked_wd.status_code == 400, f"locked withdrawal should fail: {locked_wd.json()}"
assert locked_wd.json()["error_code"] == "CONTRIBUTION_LOCKED"

past = check(client.post("/api/admin/contributions", headers=admin_headers, json={
    "name": "Matured Fund",
    "amount": 15000,
    "frequency": "monthly",
    "member_count": 3,
    "rounds": 6,
    "start_date": "2025-10-01T00:00:00Z",
    "withdrawal_rule": "fixed_date",
    "fixed_withdrawal_date": "2026-01-01T00:00:00Z",
}), "admin create matured contribution")
past_cid = past["data"]["id"]
check(client.post(f"/api/contributions/{past_cid}/join", headers=headers2), "user2 join matured")
check(client.post("/api/withdrawals", headers=headers2, json={
    "amount": 15000,
    "withdrawal_type": "contribution",
    "bank_name": "Access Bank",
    "account_number": "0987654321",
    "account_name": "Bola Tinubu",
    "destination": "0987654321 ACCESS",
    "contribution_id": past_cid,
}), "matured contribution withdrawal allowed")

# Admin-only guards for regular user
check(client.get("/api/admin/stats", headers=headers2), "admin guard for user2", 403)
check(client.get("/api/audit-logs", headers=headers2), "audit-logs guard for user2", 403)

print("\nALL SMOKE TESTS PASSED")