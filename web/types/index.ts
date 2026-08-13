export type Role = "user" | "admin"

export type UserStatus = "active" | "suspended" | "invited"

export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  role: Role
  status: UserStatus
  avatar?: string
  photo?: string
  joinedAt: string
  createdAt: string
}

export type Frequency = "weekly" | "biweekly" | "monthly" | "custom"

export type ContributionStatus =
  | "active"
  | "upcoming"
  | "completed"
  | "paused"
  | "draft"

export interface ContributionMember {
  id: string
  userId?: string
  name: string
  avatar?: string
  position: number
  totalContributed: number
}

export interface ContributionScheduleEntry {
  period: string
  label: string
  dueDate: string
  status: "paid" | "pending" | "upcoming"
  amount: number
}

export interface WithdrawalRule {
  type: "on_schedule" | "fixed_date"
  eligibleDate?: string
  note?: string
}

export interface Contribution {
  id: string
  name: string
  description: string
  amount: number
  frequency: Frequency
  memberCount: number
  rounds: number
  startDate: string
  endDate: string
  withdrawalDate: string
  totalContributed: number
  totalExpected: number
  progress: number
  status: ContributionStatus
  nextPaymentDate: string
  lastPaymentDate?: string
  members: ContributionMember[]
  schedule: ContributionScheduleEntry[]
  withdrawalRule: WithdrawalRule
  currentUserPosition?: number
  organization?: string
}

export type SavingsGoalStatus = "active" | "paused" | "completed"

export interface SavingsGoal {
  id: string
  name: string
  target: number
  current: number
  status: SavingsGoalStatus
  createdAt: string
  targetDate?: string
  color?: string
}

export interface SavingsAccount {
  balance: number
  totalSaved: number
  totalWithdrawn: number
  goals: SavingsGoal[]
}

export type TransactionType = "contribution" | "savings" | "funding" | "withdrawal"

export type TransactionStatus = "successful" | "pending" | "failed" | "reverted"

export interface Transaction {
  id: string
  type: TransactionType
  status: TransactionStatus
  amount: number
  description: string
  date: string
  reference: string
  metadata?: {
    contributionName?: string
    method?: string
    destination?: string
    fee?: number
  }
}

export type WithdrawalStatus = "pending" | "approved" | "rejected" | "completed"

export interface Withdrawal {
  id: string
  userId: string
  userName: string
  amount: number
  type: "savings" | "contribution"
  requestedAt: string
  destination: string
  status: WithdrawalStatus
  contributionName?: string
  bankName?: string
  accountName?: string
  accountNumber?: string
  reviewedAt?: string
}

export type SupportCategory =
  | "general"
  | "account"
  | "contribution"
  | "savings"
  | "withdrawal"
  | "other"

export type SupportStatus = "open" | "replied" | "resolved"

export interface SupportMessage {
  id: string
  threadId: string
  senderId?: string
  senderRole: string
  senderName: string
  body: string
  isRead: boolean
  createdAt: string
}

export interface SupportThread {
  id: string
  userId: string
  subject: string
  category: SupportCategory
  status: SupportStatus
  unreadCount: number
  lastMessageAt: string
  createdAt: string
  updatedAt: string
}

export interface SupportThreadDetail extends SupportThread {
  messages: SupportMessage[]
}

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "reject"
  | "revert"
  | "suspend"
  | "reactivate"
  | "invite"
  | "login"
  | "logout"
  | "settings_update"

export type AuditCategory =
  | "user"
  | "contribution"
  | "savings"
  | "withdrawal"
  | "transaction"
  | "system"
  | "settings"

export interface AuditLog {
  id: string
  actorId?: string
  actorName?: string
  actorEmail?: string
  actorRole?: string
  action: AuditAction
  category: AuditCategory
  description: string
  target?: string
  targetId?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

export type NotificationType = "contribution" | "savings" | "withdrawal" | "system"

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  createdAt: string
  read: boolean
}

export interface AdminStats {
  totalUsers: number
  activeContributions: number
  totalFunds: number
  pendingWithdrawals: number
  monthlyVolume: number
  userGrowth: Array<{
    month: string
    users: number
  }>
  contributionVolume: Array<{
    month: string
    volume: number
  }>
  contributionStatus: Array<{
    name: string
    value: number
  }>
}

export interface DashboardOverview {
  totalBalance: number
  totalSavings: number
  activeContributions: number
  nextContribution: {
    amount: number
    dueDate: string
    daysLeft: number
  }
  savingsGrowth: Array<{
    month: string
    amount: number
  }>
  contributionActivity: Array<{
    month: string
    contributions: number
  }>
  contributionDistribution: Array<{
    name: string
    value: number
  }>
  recentTransactions: Transaction[]
  upcomingContribution?: Contribution
}