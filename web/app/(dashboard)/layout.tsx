import { AppShell } from "@/components/layout/app-shell"

export const metadata = {
  title: "Dashboard",
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell>{children}</AppShell>
}