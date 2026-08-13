import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  Users,
  PiggyBank,
  ArrowLeftRight,
  Bell,
  User,
  Settings,
  Wallet,
  LifeBuoy,
  ScrollText,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  exact?: boolean
}

export const userNavGroups: Array<{
  label: string
  items: NavItem[]
}> = [
  {
    label: "Main",
    items: [
      { label: "Overview", href: "/dashboard", icon: LayoutDashboard, exact: true },
      { label: "Contributions", href: "/contributions", icon: Users },
      { label: "Savings", href: "/savings", icon: PiggyBank },
      { label: "Transactions", href: "/transactions", icon: ArrowLeftRight },
      { label: "Notifications", href: "/notifications", icon: Bell },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Profile", href: "/profile", icon: User },
      { label: "Help & Support", href: "/support", icon: LifeBuoy },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
]

export const adminNavGroups: Array<{
  label: string
  items: NavItem[]
}> = [
  {
    label: "Admin",
    items: [
      { label: "Overview", href: "/admin/dashboard", icon: LayoutDashboard, exact: true },
      { label: "Contributions", href: "/admin/contributions", icon: Users },
      { label: "Users", href: "/admin/users", icon: User },
      { label: "Withdrawals", href: "/admin/withdrawals", icon: Wallet },
      { label: "Transactions", href: "/admin/transactions", icon: ArrowLeftRight },
      { label: "Messages", href: "/admin/support", icon: LifeBuoy },
      { label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Profile", href: "/admin/profile", icon: User },
      { label: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
]

export const mobilePrimaryNav: Array<{
  label: string
  href: string
  icon: LucideIcon
}> = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Contributions", href: "/contributions", icon: Users },
  { label: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { label: "Profile", href: "/profile", icon: User },
]

export const adminMobilePrimaryNav: Array<{
  label: string
  href: string
  icon: LucideIcon
}> = [
  { label: "Overview", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: User },
  { label: "Transactions", href: "/admin/transactions", icon: ArrowLeftRight },
  { label: "Settings", href: "/admin/settings", icon: Settings },
]