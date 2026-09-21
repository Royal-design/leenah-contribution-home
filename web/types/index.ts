export type Role = "user" | "admin"

export type UserStatus = "active" | "suspended" | "invited"

export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  role: Role
  roles?: Role[]
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

export type SavingsPlanStatus =
  | "active"
  | "upcoming"
  | "completed"
  | "paused"
  | "draft"

export type ScheduleStatus = "paid" | "pending" | "upcoming"

export type EnrollmentStatus = "active" | "left"

export interface ContributionMember {
  id: string
  userId?: string
  name: string
  avatar?: string
  position: number
  totalContributed: number
  joinedAt?: string
}

export interface ContributionScheduleEntry {
  id: number
  period: string
  label: string
  dueDate: string
  status: "paid" | "pending" | "upcoming"
  amount: number
}

export type PayoutStatus = "pending" | "paid" | "skipped"

export interface ContributionPayout {
  id: string
  contributionId: string
  memberId: string
  roundNumber: number
  scheduledDate: string
  amount: number
  status: PayoutStatus
  paidAt?: string
  transactionId?: string
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
  payouts?: ContributionPayout[]
  withdrawalRule: WithdrawalRule
  currentUserPosition?: number
  organization?: string
  createdBy?: string
  isOpen: boolean
}

export type SavingsGoalStatus = "active" | "paused" | "completed"

export interface SavingsPlanScheduleEntry {
  id: number
  period: string
  label: string | null
  dueDate: string
  status: ScheduleStatus
  amount: number
  paidAt?: string
  attemptCount: number
  failureReason?: string | null
}

export interface SavingsPlanEnrollment {
  id: string
  planId: string
  userId: string
  totalSaved: number
  nextPaymentDate?: string | null
  status: EnrollmentStatus
  joinedAt: string
}

export interface SavingsPlan {
  id: string
  name: string
  description: string
  organization?: string
  amount: number
  targetAmount?: number
  frequency: Frequency
  durationMonths?: number
  startDate: string
  endDate?: string
  nextPaymentDate?: string | null
  lastPaymentDate?: string | null
  rounds: number
  totalSaved: number
  totalExpected: number
  progress: number
  status: SavingsPlanStatus
  isOpen: boolean
  enrollCount: number
  createdBy: string
  createdAt: string
  enrollment?: SavingsPlanEnrollment | null
  schedule: SavingsPlanScheduleEntry[]
}

export interface SavingsPlanEnrollmentDetail {
  id: string
  userId: string
  userName: string
  userEmail?: string
  totalSaved: number
  nextPaymentDate?: string | null
  status: EnrollmentStatus
  joinedAt: string
}

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
  reserved: number
  totalBalance: number
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

export type WithdrawalStatus = "pending" | "approved" | "processing" | "rejected" | "completed" | "failed" | "reversed"

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
  maskedAccountNumber?: string
  processingMessage?: string
  reviewedAt?: string
  approvedAt?: string
  completedAt?: string
  rejectedAt?: string
  failureReason?: string
  bankAccountId?: string
  paystackRecipientCode?: string
  paystackTransferCode?: string
  paystackReference?: string
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
  userName?: string
  userEmail?: string
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
  totalPlans: number
  activeSavingsPlans: number
  activePlans: number
  totalInContributionPlans: number
  totalInSavingsPlans: number
  planVolume: Array<{
    month: string
    volume: number
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

/* --------------------------------- Wallet / Paystack -------------------------------- */

export type DVStatus = "pending" | "active" | "failed" | "inactive"

export interface DVA {
  id: string
  userId: string
  paystackCustomerCode: string
  paystackDedicatedAccountId: string | null
  accountNumber: string | null
  accountName: string | null
  bankName: string | null
  bankSlug: string | null
  currency: string
  status: DVStatus
  createdAt: string
  updatedAt: string
  fundingInstruction: string | null
}

export interface BankAccount {
  id: string
  userId: string
  bankCode: string | null
  bankName: string
  accountNumber: string
  accountName: string | null
  isVerified: boolean
  isDefault: boolean
  providerRecipientCode: string | null
  accountNumberMasked: string
  createdAt: string
}

export interface Bank {
  name: string
  code: string
  slug: string
  longcode?: string
}