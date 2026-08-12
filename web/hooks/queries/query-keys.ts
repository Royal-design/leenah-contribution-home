export const queryKeys = {
  contributions: {
    all: ["contributions"] as const,
    detail: (id: string) => ["contributions", id] as const,
  },
  savings: {
    all: ["savings"] as const,
  },
  savingsGrowth: ["savings-growth"] as const,
  transactions: {
    all: ["transactions"] as const,
    list: (filters: unknown) => ["transactions", filters] as const,
    recent: ["transactions", "recent"] as const,
  },
  notifications: ["notifications"] as const,
  users: ["users"] as const,
  withdrawals: ["withdrawals"] as const,
  adminStats: ["admin-stats"] as const,
  currentUser: ["current-user"] as const,
}