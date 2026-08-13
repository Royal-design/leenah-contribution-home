import type {
  AdminStats,
  AppNotification,
  Contribution,
  ContributionMember,
  ContributionScheduleEntry,
  SavingsAccount,
  SavingsGoal,
  Transaction,
  TransactionStatus,
  TransactionType,
  User,
  UserStatus,
  Withdrawal,
  WithdrawalRule,
} from "@/types"

/* -------------------------------- Users -------------------------------- */

export interface RawUser {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  role: "user" | "admin"
  status: UserStatus
  provider: string
  avatar: string | null
  is_active: boolean
  is_verified: boolean
  preferences: Record<string, unknown>
  created_at: string
}

export function mapUser(raw: RawUser): User {
  return {
    id: raw.id,
    firstName: raw.first_name,
    lastName: raw.last_name,
    email: raw.email,
    phone: raw.phone ?? "",
    role: raw.role,
    status: raw.status,
    avatar: raw.avatar ?? undefined,
    photo: raw.avatar ?? undefined,
    joinedAt: raw.created_at,
    createdAt: raw.created_at,
  }
}

/* --------------------------- Contributions ----------------------------- */

export interface RawContributionMember {
  id: string
  user_id: string
  display_name: string
  avatar: string | null
  position: number
  total_contributed: number
  joined_at: string
}

export interface RawContributionScheduleEntry {
  id: number
  period: string
  label: string | null
  due_date: string
  status: "paid" | "pending" | "upcoming"
  amount: number
}

export interface RawContribution {
  id: string
  name: string
  description: string | null
  organization: string | null
  amount: number
  frequency: "weekly" | "biweekly" | "monthly" | "custom"
  member_count: number
  rounds: number
  start_date: string
  end_date: string | null
  withdrawal_date: string | null
  next_payment_date: string | null
  last_payment_date: string | null
  total_contributed: number
  total_expected: number
  progress: number
  status: "active" | "upcoming" | "completed" | "paused" | "draft"
  withdrawal_rule: Record<string, unknown> | null
  is_open: boolean
  created_by: string
  created_at: string
  members?: RawContributionMember[]
  schedule?: RawContributionScheduleEntry[]
}

export function mapContribution(raw: RawContribution): Contribution {
  const members: ContributionMember[] = (raw.members ?? []).map((member) => ({
    id: member.id,
    userId: member.user_id,
    name: member.display_name,
    avatar: member.avatar ?? undefined,
    position: member.position,
    totalContributed: member.total_contributed,
  }))

  const schedule: ContributionScheduleEntry[] = (raw.schedule ?? []).map((entry) => ({
    period: entry.period,
    label: entry.label ?? `Round ${entry.period}`,
    dueDate: entry.due_date,
    status: entry.status,
    amount: entry.amount,
  }))

  const rule = raw.withdrawal_rule
  const ruleType = rule?.type === "fixed_date" ? "fixed_date" : "on_schedule"
  const withdrawalRule: WithdrawalRule = {
    type: ruleType,
    eligibleDate:
      (rule?.fixed_date as string | undefined) ??
      raw.withdrawal_date ??
      undefined,
    note: (rule?.note as string | undefined) ?? undefined,
  }

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? "",
    organization: raw.organization ?? undefined,
    amount: raw.amount,
    frequency: raw.frequency,
    memberCount: raw.member_count,
    rounds: raw.rounds,
    startDate: raw.start_date,
    endDate: raw.end_date ?? "",
    withdrawalDate: raw.withdrawal_date ?? "",
    totalContributed: raw.total_contributed,
    totalExpected: raw.total_expected,
    progress: raw.progress,
    status: raw.status,
    nextPaymentDate: raw.next_payment_date ?? "",
    lastPaymentDate: raw.last_payment_date ?? undefined,
    members,
    schedule,
    withdrawalRule,
  }
}

/* ------------------------------- Savings -------------------------------- */

export interface RawSavingsGoal {
  id: string
  account_id: string
  name: string
  target: number
  current: number
  status: "active" | "paused" | "completed"
  color: string | null
  target_date: string | null
  created_at: string
}

export interface RawSavingsAccount {
  id: string
  user_id: string
  balance: number
  total_saved: number
  total_withdrawn: number
  created_at: string
  updated_at: string
  goals?: RawSavingsGoal[]
}

export function mapSavingsGoal(raw: RawSavingsGoal): SavingsGoal {
  return {
    id: raw.id,
    name: raw.name,
    target: raw.target,
    current: raw.current,
    status: raw.status,
    createdAt: raw.created_at,
    targetDate: raw.target_date ?? undefined,
    color: raw.color ?? undefined,
  }
}

export function mapSavingsAccount(raw: RawSavingsAccount): SavingsAccount {
  return {
    balance: raw.balance,
    totalSaved: raw.total_saved,
    totalWithdrawn: raw.total_withdrawn,
    goals: (raw.goals ?? []).map(mapSavingsGoal),
  }
}

/* ----------------------------- Transactions ----------------------------- */

export interface RawTransaction {
  id: string
  user_id: string
  type: TransactionType
  status: TransactionStatus
  amount: number
  description: string
  reference: string
  details: Record<string, unknown> | null
  date: string
}

export function mapTransaction(raw: RawTransaction): Transaction {
  return {
    id: raw.id,
    type: raw.type,
    status: raw.status,
    amount: raw.amount,
    description: raw.description,
    date: raw.date,
    reference: raw.reference,
    metadata: raw.details
      ? {
          contributionName: raw.details.contribution_name as string | undefined,
          method: raw.details.method as string | undefined,
          destination: raw.details.destination as string | undefined,
          fee: raw.details.fee as number | undefined,
        }
      : undefined,
  }
}

/* ------------------------------ Withdrawals ----------------------------- */

export interface RawWithdrawal {
  id: string
  user_id: string
  amount: number
  withdrawal_type: string
  bank_name: string
  account_number: string
  account_name: string | null
  destination: string
  contribution_name: string | null
  status: "pending" | "approved" | "rejected" | "completed"
  requested_at: string
  reviewed_by: string | null
  reviewed_at: string | null
}

export function mapWithdrawal(raw: RawWithdrawal): Withdrawal {
  return {
    id: raw.id,
    userId: raw.user_id,
    userName: raw.account_name ?? "",
    amount: raw.amount,
    type: (["savings", "contribution"].includes(raw.withdrawal_type)
      ? raw.withdrawal_type
      : "savings") as "savings" | "contribution",
    requestedAt: raw.requested_at,
    destination: raw.destination,
    status: raw.status,
    contributionName: raw.contribution_name ?? undefined,
    bankName: raw.bank_name,
    accountName: raw.account_name ?? undefined,
    accountNumber: raw.account_number,
    reviewedAt: raw.reviewed_at ?? undefined,
  }
}

/* ----------------------------- Notifications ---------------------------- */

export interface RawNotification {
  id: string
  type: "contribution" | "savings" | "withdrawal" | "system"
  title: string
  message: string | null
  is_read: boolean
  created_at: string
}

export function mapNotification(raw: RawNotification): AppNotification {
  return {
    id: raw.id,
    type: raw.type,
    title: raw.title,
    message: raw.message ?? "",
    createdAt: raw.created_at,
    read: raw.is_read,
  }
}

/* ------------------------------ Admin stats ----------------------------- */

export interface RawAdminStats {
  total_users: number
  active_contributions: number
  total_funds: number
  pending_withdrawals: number
  monthly_volume: number
  user_growth: Array<{ month: string; users: number }>
  contribution_volume: Array<{ month: string; volume: number }>
  contribution_status: Array<{ name: string; value: number }>
}

export function mapAdminStats(raw: RawAdminStats): AdminStats {
  return {
    totalUsers: raw.total_users,
    activeContributions: raw.active_contributions,
    totalFunds: raw.total_funds,
    pendingWithdrawals: raw.pending_withdrawals,
    monthlyVolume: raw.monthly_volume,
    userGrowth: raw.user_growth,
    contributionVolume: raw.contribution_volume,
    contributionStatus: raw.contribution_status,
  }
}

/* ------------------------------ Support & audit -------------------------- */

export interface RawSupportMessage {
  id: string
  thread_id: string
  sender_id: string | null
  sender_role: string
  sender_name: string
  body: string
  is_read: boolean
  created_at: string
}

export interface RawSupportThread {
  id: string
  user_id: string
  subject: string
  category: string
  status: "open" | "replied" | "resolved"
  unread_count: number
  last_message_at: string
  created_at: string
  updated_at: string
  messages?: RawSupportMessage[]
}

export interface RawAuditLog {
  id: string
  actor_id: string | null
  actor_name: string | null
  actor_email: string | null
  actor_role: string | null
  action: string
  category: string
  description: string
  target: string | null
  target_id: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface RawRoleSummary {
  name: string
  label: string
  description: string
  permissions: string[]
  user_count: number
}