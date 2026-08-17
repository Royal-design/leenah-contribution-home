export const queryKeys = {
  contributions: {
    all: ["contributions"] as const,
    open: ["contributions", "open"] as const,
    detail: (id: string) => ["contributions", id] as const,
  },
  savings: {
    all: ["savings"] as const,
    goals: ["savings", "goals"] as const,
  },
  savingsGrowth: ["savings-growth"] as const,
  wallet: {
    all: ["wallet"] as const,
    dva: ["wallet", "dva"] as const,
    bankAccounts: ["wallet", "bank-accounts"] as const,
    banks: ["wallet", "banks"] as const,
  },
  transactions: {
    all: ["transactions"] as const,
    list: (filters: unknown) => ["transactions", filters] as const,
    recent: ["transactions", "recent"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    unreadCount: ["notifications", "unread-count"] as const,
  },
  users: {
    all: ["users"] as const,
    list: (filters: unknown) => ["users", filters] as const,
    detail: (id: string) => ["users", id] as const,
  },
  withdrawals: {
    all: ["withdrawals"] as const,
    list: (filters: unknown) => ["withdrawals", filters] as const,
  },
  support: {
    all: ["support"] as const,
    list: (filters: unknown) => ["support", filters] as const,
    detail: (id: string) => ["support", id] as const,
    unreadCount: ["support", "unread-count"] as const,
  },
  auditLogs: {
    all: ["audit-logs"] as const,
    list: (filters: unknown) => ["audit-logs", filters] as const,
    actions: ["audit-logs", "actions"] as const,
  },
  adminStats: ["admin-stats"] as const,
  adminOverview: ["admin-overview"] as const,
  adminRoles: ["admin-roles"] as const,
  adminUsers: {
    all: ["admin-users"] as const,
    list: (filters: unknown) => ["admin-users", filters] as const,
    detail: (id: string) => ["admin-users", id] as const,
  },
  adminContributions: {
    all: ["admin-contributions"] as const,
    list: (filters: unknown) => ["admin-contributions", filters] as const,
    detail: (id: string) => ["admin-contributions", id] as const,
  },
  adminTransactions: {
    all: ["admin-transactions"] as const,
    list: (filters: unknown) => ["admin-transactions", filters] as const,
  },
  adminWithdrawals: {
    all: ["admin-withdrawals"] as const,
    list: (filters: unknown) => ["admin-withdrawals", filters] as const,
  },
  currentUser: ["current-user"] as const,
}