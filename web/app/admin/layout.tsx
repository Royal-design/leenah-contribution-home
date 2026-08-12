import { AppShell } from "@/components/layout/app-shell"

export const metadata = {
  title: "Admin",
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell isAdmin>{children}</AppShell>
}