# LCH — Savings & Contribution Plans

An admin-managed **Savings & Contribution Plans** platform. Admins create plans; users discover, join, and track their participation. Contribution plans operate as a **rotational savings circle** (esusu/ajo model) where each member withdraws the pot once, in a fair, first-come-first-served order.

- **Frontend:** Next.js (App Router, React 19, TypeScript, Tailwind, shadcn-style components, TanStack Query)
- **Backend:** FastAPI + SQLAlchemy + Alembic (PostgreSQL)
- **Auth:** JWT access tokens (30 min) + rotating refresh tokens, role-based admin access

---

## The big picture

Two kinds of plans, both created and managed by the **admin**:

- **Savings Plans** — members save toward their own goal on a shared schedule. No rotation.
- **Contribution Plans** — a group circle with a **rotation**. Members contribute every period; the money collected in each period is paid out to **one member at a time**, in a fixed, system-assigned order.

Users **never create plans**. They browse, join, and track — the admin controls everything.

---

## How it works — admin to user

### 1. Admin creates a plan

From the admin dashboard: **Create Savings Plan** or **Create Contribution Plan**. Configuration includes:

- Name, description, organization
- Amount and **frequency** (weekly / bi-weekly / monthly / custom)
- **Start date**
- **Duration** — preset (1, 3, 6, 12 months) or custom
- For contributions: **maximum participants**

The system **automatically calculates** the end date from start date + duration. For contribution plans it also shows how many **withdrawal positions** are available (one per contribution round) and prevents participants from exceeding the number of rounds.

**Guardrail:** plans cannot be created with a start date in the past.

### 2. The contribution rotation

- Users who join are assigned positions **in the order they join** (first come, first served). The system guarantees two users can never get the same position, even if they join at the same instant.
- Each position gets an **automatic withdrawal schedule** derived from the plan's start date, frequency, and position. For **monthly** plans, withdrawals land at the **end of each calendar month**:
  - Position 1 → end of month 1 · Position 2 → end of month 2 · … · Position 12 → end of month 12
  - Month-end dates, February, and leap years are handled automatically.

Example — a 12-month monthly plan starting January with 12 members:

| Position | Member | Withdraws |
| -------- | ------ | --------- |
| 1        | Member A | end of January |
| 2        | Member B | end of February |
| 3        | Member C | end of March |
| …        | …      | … |
| 12       | Member L | end of December |

### 3. Admin manages the rotation

The contribution plan's **Members / Rotation** screen shows the full order (position, participant, joined at, withdrawal period, status). Admins can:

- **Move a participant up or down** — but only **before the plan starts**.
- **Remove a participant** who hasn't paid anything yet.

Once the plan has started (any contributions/payouts occurred), the rotation is **locked** — no reordering and no removal of paying members. This protects money already in the cycle. Savings plans follow the same rule: a member who has started paying cannot be removed.

### 4. What the user sees

- **Explore Plans** — browse all open savings and contribution plans (amount, frequency, date range, duration, status).
- **Plan details** — full information and a single **Join** action. If a plan already started, joining is blocked (only an admin can add the member manually).
- After joining a contribution, the member sees a **"My position"** card — their position, expected withdrawal month, contribution amount/frequency, and live progress.
- **My Plans** — every joined plan with progress, next payment, and expected withdrawal.

### 5. Money flow (contributions)

1. Members fund their **wallets**.
2. On each due date, contributions are collected from the wallet.
3. When **every active member has paid a given round**, the member holding that round's position is **automatically paid out** the pooled amount into their wallet.
4. Members withdraw from their wallet normally.

---

## House rules

| Action | Allowed? |
| ------ | -------- |
| User creates a plan | ❌ Only admin creates |
| User joins a plan that already started | ❌ Unless the admin adds them |
| Admin reorders the rotation before start | ✅ |
| Admin reorders after start / payouts | ❌ Locked |
| Admin removes a member who has paid | ❌ Blocked |
| Admin adds a member manually | ✅ (bypasses the join-date restriction) |
| Two users get the same position | ❌ Never (system-enforced) |

---

## Running locally

### Backend (FastAPI)

```bash
cd backend
python -m venv .venv
# activate venv, then:
pip install -r requirements.txt
# configure backend/.env (DATABASE_URL, SECRET_KEY, etc.)
alembic upgrade head
python seed.py              # optional demo data (admin@gmail.com / user@gmail.com)
uvicorn app.main:app --reload
```

### Frontend (Next.js)

```bash
cd web
bun install
bun run dev                # http://localhost:3000
```

Set `NEXT_PUBLIC_API_URL` to the backend URL (default `http://127.0.0.1:8000`).

### Quality checks

```bash
bun run typecheck   # TypeScript
bun run lint        # ESLint
bun run build       # Next build
cd backend && .venv/Scripts/python.exe -m pytest tests/  # backend tests
```

---

## Repository layout

```
backend/            FastAPI app (models, schemas, services, repositories, routes)
  app/api/routes/   Auth, users, contributions, savings-plans, admin, wallet, …
  app/services/     Domain logic (rotation, payouts, join/enroll, collections)
  alembic/versions/ Schema migrations
  tests/            pytest suites (dates, rotation, contributions, payments)
web/                Next.js app
  app/              Pages: user (plans, my-plans, dashboard …) and admin (plans, savings-plans …)
  components/       Reusable UI (plan cards, tables, dialogs, charts, navigation)
  lib/api/          API clients + mappers + auth/session handling
  hooks/queries/    TanStack Query hooks