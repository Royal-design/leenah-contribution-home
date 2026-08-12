import type {
  AppNotification,
  Contribution,
  SavingsAccount,
  Transaction,
  User,
  Withdrawal,
} from "@/types"
import { contributions as seedContributions } from "@/lib/mock/contributions"
import { savingsAccount as seedSavings } from "@/lib/mock/savings"
import { transactions as seedTransactions } from "@/lib/mock/transactions"
import { notifications as seedNotifications } from "@/lib/mock/notifications"
import { withdrawals as seedWithdrawals } from "@/lib/mock/withdrawals"
import { users as seedUsers } from "@/lib/mock/users"

interface MockDatabase {
  users: User[]
  contributions: Contribution[]
  savings: SavingsAccount
  transactions: Transaction[]
  notifications: AppNotification[]
  withdrawals: Withdrawal[]
}

const db: MockDatabase = {
  users: [...seedUsers],
  contributions: [...seedContributions],
  savings: {
    ...seedSavings,
    goals: [...seedSavings.goals],
  },
  transactions: [...seedTransactions],
  notifications: [...seedNotifications],
  withdrawals: [...seedWithdrawals],
}

export function getDb() {
  return db
}